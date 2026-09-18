/**
 * Persist Decision Engine outputs to recommendation_decisions (service_role).
 * FASE 5: preserves outcome / outcome_metrics across daily rewrite.
 */
import { adminDbLoose } from "@/lib/db-admin";
import type { EngineDecision } from "@/lib/engine/decision";
import { sanitizeSnapshotForLog } from "@/lib/engine/decision";
import type { ContextSnapshot } from "@/lib/engine/context-snapshot";
import type { OutcomeMetrics } from "@/lib/engine/outcome-learning";

type PriorOutcome = {
  outcome: string | null;
  outcome_metrics: OutcomeMetrics | Record<string, unknown> | null;
};

export async function logRecommendationDecisions(opts: {
  userId: string;
  date: string;
  decisions: EngineDecision[];
  snapshot: ContextSnapshot;
  engine?: string;
}): Promise<{ ok: boolean }> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return { ok: false };

    const engine = opts.engine ?? "decision_v1";

    // Preserve outcomes before wipe (rewrite-safe)
    const { data: priorRows } = await db
      .from("recommendation_decisions")
      .select("decision_type, outcome, outcome_metrics")
      .eq("user_id", opts.userId)
      .eq("date", opts.date)
      .eq("engine", engine);

    const priorByType = new Map<string, PriorOutcome>();
    for (const row of priorRows ?? []) {
      const t = String((row as { decision_type?: string }).decision_type ?? "");
      if (!t) continue;
      const existing = priorByType.get(t);
      const outcome = (row as { outcome?: string | null }).outcome ?? null;
      const metrics =
        ((row as { outcome_metrics?: PriorOutcome["outcome_metrics"] }).outcome_metrics as PriorOutcome["outcome_metrics"]) ??
        null;
      // Prefer row that already has an outcome
      if (!existing || (outcome && !existing.outcome)) {
        priorByType.set(t, { outcome, outcome_metrics: metrics });
      }
    }

    const inputSnapshot = sanitizeSnapshotForLog(opts.snapshot);
    const rows = opts.decisions.map((d) => {
      const prior = priorByType.get(d.decisionType);
      return {
        user_id: opts.userId,
        date: opts.date,
        engine,
        decision_type: d.decisionType,
        decision_value: { value: d.decisionValue },
        reason_codes: d.reasonCodes,
        input_snapshot: inputSnapshot,
        confidence: d.confidence,
        outcome: prior?.outcome ?? null,
        outcome_metrics: prior?.outcome_metrics ?? null,
      };
    });

    await db
      .from("recommendation_decisions")
      .delete()
      .eq("user_id", opts.userId)
      .eq("date", opts.date)
      .eq("engine", engine);

    const { error } = await db.from("recommendation_decisions").insert(rows);
    if (error) {
      console.warn("recommendation_decisions insert failed", error);
      return { ok: false };
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
    return { ok: true };
  } catch (e) {
    console.warn("markDecisionOutcomes skipped", e);
    return { ok: false };
  }
}

/** Merge metrics onto yesterday's decisions (D+1 check-in), keep existing outcome string. */
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
    for (const row of rows) {
      const dv = (row as { decision_value?: { value?: unknown } }).decision_value;
      const val = dv?.value;
      if (
        (row as { decision_type?: string }).decision_type === "training_volume" &&
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
        (row as { decision_type?: string }).decision_type === "training_volume" &&
        typeof val === "number"
      ) {
        merged["volumeFactor"] = prev["volumeFactor"] ?? val;
      }
      await db
        .from("recommendation_decisions")
        .update({ outcome_metrics: merged })
        .eq("id", (row as { id: string }).id);
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
    decision_type: string;
    decision_value: { value?: unknown };
    outcome: string | null;
    outcome_metrics: OutcomeMetrics | null;
  }>
> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return [];
    const { data } = await db
      .from("recommendation_decisions")
      .select("decision_type, decision_value, outcome, outcome_metrics")
      .eq("user_id", opts.userId)
      .eq("date", opts.date);
    return (data ?? []) as Array<{
      decision_type: string;
      decision_value: { value?: unknown };
      outcome: string | null;
      outcome_metrics: OutcomeMetrics | null;
    }>;
  } catch {
    return [];
  }
}
