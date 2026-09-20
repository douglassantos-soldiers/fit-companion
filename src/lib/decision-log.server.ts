/**
 * Persist Decision Engine outputs to recommendation_decisions (service_role).
 * Phase 5: canonical decision_type, structured evidence, upsert (preserve ids/FKs),
 * dual-write decision_outcomes including D+1 metrics.
 *
 * Physical columns: decision_value (= value), input_snapshot (= context_snapshot).
 * SoT of outcomes = decision_outcomes; outcome/outcome_metrics on decision row = legacy.
 */
import { adminDbLoose } from "@/lib/db-admin";
import type { EngineDecision } from "@/lib/engine/decision";
import { sanitizeSnapshotForLog } from "@/lib/engine/decision";
import type { ContextSnapshot } from "@/lib/engine/context-snapshot";
import type { OutcomeMetrics } from "@/lib/engine/outcome-learning";
import {
  evidenceFromSnapshotLike,
  mergeEvidence,
  type DecisionEvidence,
} from "@/lib/engine/decision-evidence";
import {
  engineTypeToCanonical,
  refineWorkoutModeCanonical,
  type PerformanceDecisionType,
} from "@/lib/engine/performance-decision-types";
import { logEngineDecision } from "@/lib/engine/observability";

type PriorRow = {
  id: string;
  decision_type: string;
  outcome: string | null;
  outcome_metrics: OutcomeMetrics | Record<string, unknown> | null;
};

function canonicalTypeForDecision(d: EngineDecision): PerformanceDecisionType {
  if (d.decisionType === "training_mode" && typeof d.decisionValue === "string") {
    return refineWorkoutModeCanonical(d.decisionValue);
  }
  if (d.decisionType === "primary_action" && d.decisionValue === "sleep") {
    return "SLEEP_PRIORITY";
  }
  if (d.decisionType === "primary_action" && d.decisionValue === "rest") {
    return "REST";
  }
  return engineTypeToCanonical(d.decisionType);
}

function buildEvidence(d: EngineDecision, snapshot: ContextSnapshot): DecisionEvidence {
  const base = evidenceFromSnapshotLike({
    sleepHours: snapshot.sleep.hours,
    energy: snapshot.energy,
    availableMin: snapshot.availableTimeMin,
    recoveryScore: snapshot.recovery.score,
    hardRpeStreak: snapshot.training.hardRpeStreak,
    proteinAdherence: snapshot.nutrition.proteinAdherence7d,
    confidenceBase: snapshot.confidenceBase,
  });
  return mergeEvidence(base, {
    metrics: {
      decisionValue:
        typeof d.decisionValue === "boolean" || typeof d.decisionValue === "number"
          ? d.decisionValue
          : String(d.decisionValue),
      confidence: d.confidence,
    },
    notes: d.explanation ? [d.explanation] : [],
  });
}

export async function logRecommendationDecisions(opts: {
  userId: string;
  date: string;
  decisions: EngineDecision[];
  snapshot: ContextSnapshot;
  engine?: string;
}): Promise<{ ok: boolean }> {
  const t0 = Date.now();
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return { ok: false };

    const engine = opts.engine ?? "decision_v1";

    const { data: priorRows } = await db
      .from("recommendation_decisions")
      .select("id, decision_type, outcome, outcome_metrics")
      .eq("user_id", opts.userId)
      .eq("date", opts.date)
      .eq("engine", engine);

    const priorByType = new Map<string, PriorRow>();
    for (const row of (priorRows ?? []) as PriorRow[]) {
      const t = String(row.decision_type ?? "");
      if (!t) continue;
      const existing = priorByType.get(t);
      if (!existing || (row.outcome && !existing.outcome)) {
        priorByType.set(t, row);
      }
      // Also index by legacy snake if prior was written as canonical
      const legacyKey = t.includes("_") ? t : null;
      if (legacyKey) priorByType.set(legacyKey, row);
    }

    const inputSnapshot = sanitizeSnapshotForLog(opts.snapshot);
    const keepTypes = new Set<string>();

    for (const d of opts.decisions) {
      const decisionType = canonicalTypeForDecision(d);
      keepTypes.add(decisionType);
      // Also match prior snake rows for outcome preservation
      const prior =
        priorByType.get(decisionType) ??
        priorByType.get(d.decisionType) ??
        null;
      const evidence = buildEvidence(d, opts.snapshot);

      const row = {
        user_id: opts.userId,
        date: opts.date,
        engine,
        decision_type: decisionType,
        decision_value: { value: d.decisionValue },
        reason_codes: d.reasonCodes,
        input_snapshot: inputSnapshot,
        evidence,
        confidence: d.confidence,
        outcome: prior?.outcome ?? null,
        outcome_metrics: prior?.outcome_metrics ?? null,
      };

      const { error } = await db.from("recommendation_decisions").upsert(row, {
        onConflict: "user_id,date,engine,decision_type",
      });
      if (error) {
        console.warn("recommendation_decisions upsert failed", error);
        logEngineDecision({
          userId: opts.userId,
          date: opts.date,
          engine,
          decisionType,
          confidence: d.confidence,
          reasonCodes: d.reasonCodes,
          success: false,
          durationMs: Date.now() - t0,
          reason: "upsert_failed",
        });
        return { ok: false };
      }

      logEngineDecision({
        userId: opts.userId,
        date: opts.date,
        engine,
        decisionType,
        confidence: d.confidence,
        reasonCodes: d.reasonCodes,
        success: true,
        durationMs: Date.now() - t0,
        reason: d.explanation.slice(0, 120),
      });
    }

    // Remove stale types for this day/engine not in current bundle
    const { data: afterRows } = await db
      .from("recommendation_decisions")
      .select("id, decision_type")
      .eq("user_id", opts.userId)
      .eq("date", opts.date)
      .eq("engine", engine);

    for (const r of (afterRows ?? []) as Array<{ id: string; decision_type: string }>) {
      if (!keepTypes.has(r.decision_type)) {
        // Soft-clean: only delete if no outcomes reference (CASCADE would wipe)
        const { count } = await db
          .from("decision_outcomes")
          .select("id", { count: "exact", head: true })
          .eq("decision_id", r.id);
        if (!count) {
          await db.from("recommendation_decisions").delete().eq("id", r.id);
        }
      }
    }

    return { ok: true };
  } catch (e) {
    console.warn("logRecommendationDecisions skipped", e);
    return { ok: false };
  }
}

export async function markDecisionOutcomes(opts: {
  userId: string;
  date: string;
  outcome: string;
  outcomeMetrics?: OutcomeMetrics | null;
  onlyUnset?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean }> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return { ok: false };

    const patch: Record<string, unknown> = { outcome: opts.outcome };
    if (opts.outcomeMetrics != null) {
      patch["outcome_metrics"] = opts.outcomeMetrics;
    }

    let q = db
      .from("recommendation_decisions")
      .update(patch)
      .eq("user_id", opts.userId)
      .eq("date", opts.date);

    if (opts.onlyUnset !== false) {
      q = q.is("outcome", null);
    }

    const { error } = await q;
    if (error) {
      console.warn("markDecisionOutcomes failed", error);
      return { ok: false };
    }

    try {
      const { data: rows } = await db
        .from("recommendation_decisions")
        .select("id")
        .eq("user_id", opts.userId)
        .eq("date", opts.date);
      if (rows?.length) {
        const dayStart = `${opts.date}T00:00:00.000Z`;
        const inserts = (rows as Array<{ id: string }>).map((r) => ({
          decision_id: r.id,
          user_id: opts.userId,
          outcome_type: opts.outcome,
          value: opts.outcomeMetrics ?? null,
          observed_at: new Date().toISOString(),
          metadata: {
            source: "mark_decision_outcomes",
            date: opts.date,
            ...(opts.metadata ?? {}),
          },
        }));
        // Light dedupe: skip if same decision_id + outcome_type already today
        for (const ins of inserts) {
          const { data: existing } = await db
            .from("decision_outcomes")
            .select("id")
            .eq("decision_id", ins.decision_id)
            .eq("outcome_type", ins.outcome_type)
            .gte("observed_at", dayStart)
            .limit(1);
          if (existing?.length) continue;
          const { error: oErr } = await db.from("decision_outcomes").insert(ins);
          if (oErr && !String(oErr.message ?? "").includes("does not exist")) {
            console.warn("decision_outcomes insert failed", oErr.message);
          }
        }
      }
    } catch {
      /* table may not exist until migration applied */
    }

    return { ok: true };
  } catch (e) {
    console.warn("markDecisionOutcomes skipped", e);
    return { ok: false };
  }
}

/** Merge metrics onto yesterday's decisions (D+1 check-in) + dual-write decision_outcomes. */
export async function appendOutcomeMetrics(opts: {
  userId: string;
  date: string;
  metrics: OutcomeMetrics;
}): Promise<{ ok: boolean; volumeReduced: boolean }> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return { ok: false, volumeReduced: false };

    const { data: rows, error } = await db
      .from("recommendation_decisions")
      .select("id, decision_type, decision_value, outcome, outcome_metrics")
      .eq("user_id", opts.userId)
      .eq("date", opts.date);

    if (error || !rows?.length) return { ok: false, volumeReduced: false };

    let volumeReduced = false;
    const dayStart = `${opts.date}T00:00:00.000Z`;

    for (const row of rows) {
      const dv = (row as { decision_value?: { value?: unknown } }).decision_value;
      const val = dv?.value;
      const dtype = String((row as { decision_type?: string }).decision_type ?? "");
      if (
        (dtype === "training_volume" || dtype === "TRAINING_VOLUME") &&
        typeof val === "number" &&
        val < 1
      ) {
        volumeReduced = true;
      }
      const prev =
        ((row as { outcome_metrics?: Record<string, unknown> | null }).outcome_metrics as Record<
          string,
          unknown
        > | null) ?? {};
      const merged = { ...prev, ...opts.metrics };
      if (
        (dtype === "training_volume" || dtype === "TRAINING_VOLUME") &&
        typeof val === "number"
      ) {
        merged["volumeFactor"] = prev["volumeFactor"] ?? val;
      }
      const id = (row as { id: string }).id;
      await db.from("recommendation_decisions").update({ outcome_metrics: merged }).eq("id", id);

      // Dual-write D+1 into decision_outcomes
      try {
        const { data: existing } = await db
          .from("decision_outcomes")
          .select("id")
          .eq("decision_id", id)
          .eq("outcome_type", "next_day_checkin")
          .gte("observed_at", dayStart)
          .limit(1);
        if (!existing?.length) {
          await db.from("decision_outcomes").insert({
            decision_id: id,
            user_id: opts.userId,
            outcome_type: "next_day_checkin",
            value: opts.metrics,
            observed_at: new Date().toISOString(),
            metadata: { source: "next_day_checkin", date: opts.date },
          });
        }
      } catch {
        /* optional */
      }
    }

    return { ok: true, volumeReduced };
  } catch (e) {
    console.warn("appendOutcomeMetrics skipped", e);
    return { ok: false, volumeReduced: false };
  }
}

export async function loadDecisionsForDate(opts: {
  userId: string;
  date: string;
}): Promise<
  Array<{
    id?: string;
    decision_type: string;
    decision_value: { value?: unknown };
    reason_codes?: string[];
    confidence?: number | null;
    evidence?: DecisionEvidence | null;
    outcome: string | null;
    outcome_metrics: OutcomeMetrics | null;
  }>
> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return [];
    const { data } = await db
      .from("recommendation_decisions")
      .select(
        "id, decision_type, decision_value, reason_codes, confidence, evidence, outcome, outcome_metrics",
      )
      .eq("user_id", opts.userId)
      .eq("date", opts.date);
    return (data ?? []) as Array<{
      id?: string;
      decision_type: string;
      decision_value: { value?: unknown };
      reason_codes?: string[];
      confidence?: number | null;
      evidence?: DecisionEvidence | null;
      outcome: string | null;
      outcome_metrics: OutcomeMetrics | null;
    }>;
  } catch {
    return [];
  }
}

export async function loadRecentOutcomes(opts: {
  userId: string;
  limit?: number;
}): Promise<
  Array<{
    decision_id: string;
    outcome_type: string;
    value: unknown;
    metadata: Record<string, unknown>;
    observed_at: string;
  }>
> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return [];
    const { data } = await db
      .from("decision_outcomes")
      .select("decision_id, outcome_type, value, metadata, observed_at")
      .eq("user_id", opts.userId)
      .order("observed_at", { ascending: false })
      .limit(opts.limit ?? 20);
    return (data ?? []) as Array<{
      decision_id: string;
      outcome_type: string;
      value: unknown;
      metadata: Record<string, unknown>;
      observed_at: string;
    }>;
  } catch {
    return [];
  }
}
