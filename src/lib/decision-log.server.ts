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
  snapshotVersion?: number;
  inputFingerprint?: string;
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

    const inputSnapshot = {
      ...sanitizeSnapshotForLog(opts.snapshot),
      ...(opts.snapshotVersion != null ? { snapshot_version: opts.snapshotVersion } : {}),
      ...(opts.inputFingerprint ? { input_fingerprint: opts.inputFingerprint } : {}),
    };
    const keepTypes = new Set<string>();

    for (const d of opts.decisions) {
      const decisionType = canonicalTypeForDecision(d);
      keepTypes.add(decisionType);
      // Also match prior snake rows for outcome preservation
      const prior = priorByType.get(decisionType) ?? priorByType.get(d.decisionType) ?? null;
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

    try {
      const { stampExpectedActions } = await import("@/lib/engine/attribution.server");
      await stampExpectedActions(opts.userId, opts.date);
    } catch {
      /* attribution table may not exist yet */
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
    if (!opts.userId) return { ok: false };
    const { actionKindFromLegacyOutcome } = await import("@/lib/engine/attribution");
    const mapped = actionKindFromLegacyOutcome(opts.outcome);
    if (!mapped) {
      logEngineDecision({
        userId: opts.userId,
        date: opts.date,
        engine: "attribution_v1",
        decisionType: opts.outcome,
        success: true,
        reason: "unmapped_no_fanout",
      });
      return { ok: true };
    }
    const extras: import("@/lib/engine/attribution").AttributionExtras = {};
    const metrics = opts.outcomeMetrics;
    if (metrics?.workoutCompleted != null) extras.workoutCompleted = metrics.workoutCompleted;
    if (metrics?.rpe !== undefined) extras.rpe = metrics.rpe ?? null;
    if (metrics?.sessionDurationMin != null) extras.sessionDurationMin = metrics.sessionDurationMin;
    if (metrics?.volumeFactor != null && metrics.volumeFactor < 1) extras.volumeReduced = true;
    const { recordAttributedEvent } = await import("@/lib/engine/attribution.server");
    const event: Parameters<typeof recordAttributedEvent>[0] = {
      userId: opts.userId,
      date: opts.date,
      actionKind: mapped.actionKind,
      status: mapped.status,
      window: mapped.window,
      extras,
      metrics: metrics ?? null,
      legacyOutcome: opts.outcome,
    };
    if (opts.onlyUnset !== undefined) event.onlyUnsetLegacy = opts.onlyUnset;
    const res = await recordAttributedEvent(event);
    return { ok: res.ok };
  } catch (e) {
    console.warn("markDecisionOutcomes skipped", e);
    return { ok: false };
  }
}

/** D+1 check-in metrics on attributed decisions only (no day fan-out). */
export async function appendOutcomeMetrics(opts: {
  userId: string;
  date: string;
  metrics: OutcomeMetrics;
}): Promise<{
  ok: boolean;
  volumeReduced: boolean;
  hits: import("@/lib/engine/attribution").AttributionHit[];
}> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return { ok: false, volumeReduced: false, hits: [] };

    const { data: rows, error } = await db
      .from("recommendation_decisions")
      .select("id, decision_type, decision_value, outcome, outcome_metrics")
      .eq("user_id", opts.userId)
      .eq("date", opts.date);

    if (error || !rows?.length) return { ok: false, volumeReduced: false, hits: [] };

    const typedRows = rows as Array<{
      id: string;
      decision_type: string;
      decision_value?: { value?: unknown };
      outcome_metrics?: Record<string, unknown> | null;
    }>;

    let volumeReduced = false;
    for (const row of typedRows) {
      const val = row.decision_value?.value;
      const dtype = String(row.decision_type ?? "");
      if (
        (dtype === "training_volume" || dtype === "TRAINING_VOLUME") &&
        typeof val === "number" &&
        val < 1
      ) {
        volumeReduced = true;
      }
    }

    const extras: import("@/lib/engine/attribution").AttributionExtras = { volumeReduced };
    if (opts.metrics.workoutCompleted != null) extras.workoutCompleted = opts.metrics.workoutCompleted;
    if (opts.metrics.rpe !== undefined) extras.rpe = opts.metrics.rpe ?? null;

    const { recordAttributedEvent } = await import("@/lib/engine/attribution.server");
    const res = await recordAttributedEvent({
      userId: opts.userId,
      date: opts.date,
      actionKind: "checkin_next_day",
      status: "completed",
      window: "d1",
      extras,
      metrics: opts.metrics,
    });

    for (const h of res.hits) {
      const prev = typedRows.find((r) => r.id === h.decisionId)?.outcome_metrics ?? {};
      await db
        .from("recommendation_decisions")
        .update({ outcome_metrics: { ...prev, ...opts.metrics } })
        .eq("id", h.decisionId)
        .eq("user_id", opts.userId);
    }

    return { ok: res.ok, volumeReduced, hits: res.hits };
  } catch (e) {
    console.warn("appendOutcomeMetrics skipped", e);
    return { ok: false, volumeReduced: false, hits: [] };
  }
}

export async function loadDecisionsForDate(opts: { userId: string; date: string }): Promise<
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

export async function loadRecentOutcomes(opts: { userId: string; limit?: number }): Promise<
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
