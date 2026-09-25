/**
 * Persist attribution: expected actions, selective outcomes, delayed windows.
 * Trusted userId only. Failures log and do not block UI.
 */
import { adminDbLoose } from "@/lib/db-admin";
import {
  ATTRIBUTION_ENGINE,
  addDaysKey,
  attributeEvent,
  canUpdateExpectedAction,
  expectedActionForDecision,
  explainAttributionFromParts,
  mergeActionRow,
  type ActionKind,
  type ActionStatus,
  type AttributionExplanation,
  type AttributionExtras,
  type AttributionHit,
  type DecisionRef,
  type ExpectedAction,
  type OutcomeQuality,
  type OutcomeWindow,
} from "@/lib/engine/attribution";
import { isLearningSignal } from "@/lib/engine/learning/signals";
import type { LearningSignal } from "@/lib/engine/learning/types";
import { logEngineDecision, logEngineError } from "@/lib/engine/observability";
import type { OutcomeMetrics } from "@/lib/engine/outcome-learning";

type DecisionRow = {
  id: string;
  decision_type: string;
  decision_value?: { value?: unknown } | null;
  reason_codes?: string[] | null;
};

function refsFromRows(rows: DecisionRow[]): DecisionRef[] {
  return rows.map((r) => ({
    id: r.id,
    decisionType: r.decision_type,
    decisionValue: r.decision_value?.value ?? null,
    reasonCodes: r.reason_codes ?? [],
  }));
}

async function loadDecisionRows(userId: string, date: string): Promise<DecisionRow[]> {
  const db = await adminDbLoose();
  if (!db) return [];
  const { data, error } = await db
    .from("recommendation_decisions")
    .select("id, decision_type, decision_value, reason_codes")
    .eq("user_id", userId)
    .eq("date", date);
  if (error || !data) return [];
  return data as DecisionRow[];
}

export async function stampExpectedActions(
  userId: string,
  date: string,
): Promise<{ ok: boolean; count: number }> {
  const t0 = Date.now();
  try {
    const db = await adminDbLoose();
    if (!db || !userId) return { ok: false, count: 0 };
    const rows = await loadDecisionRows(userId, date);
    let count = 0;
    for (const row of rows) {
      const expected = expectedActionForDecision({
        decisionType: row.decision_type,
        decisionValue: row.decision_value?.value ?? null,
      });
      if (!expected) continue;
      const { data: existing } = await db
        .from("decision_actions")
        .select("id, status, expected_action")
        .eq("decision_id", row.id)
        .maybeSingle();
      const currentStatus = (existing?.status as ActionStatus | undefined) ?? "pending";
      if (existing && !canUpdateExpectedAction(currentStatus)) continue;
      const { error } = await db.from("decision_actions").upsert(
        {
          user_id: userId,
          decision_id: row.id,
          date,
          expected_action: expected,
          status: existing ? currentStatus : "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "decision_id" },
      );
      if (error) {
        logEngineError({
          userId,
          engine: ATTRIBUTION_ENGINE,
          operation: "stamp_expected",
          errorCode: "upsert_failed",
          message: error.message,
        });
        continue;
      }
      count += 1;
    }
    logEngineDecision({
      userId,
      date,
      engine: ATTRIBUTION_ENGINE,
      decisionType: "stamp_expected",
      success: true,
      durationMs: Date.now() - t0,
      reason: `count_${count}`,
    });
    return { ok: true, count };
  } catch (e) {
    logEngineError({
      userId,
      engine: ATTRIBUTION_ENGINE,
      operation: "stamp_expected",
      errorCode: "stamp_failed",
      message: String(e),
    });
    return { ok: false, count: 0 };
  }
}

async function upsertActionForHit(opts: {
  userId: string;
  date: string;
  hit: AttributionHit;
  status: ActionStatus;
  actualAction: string;
  entityType?: string;
  entityId?: string;
}): Promise<string | null> {
  const db = await adminDbLoose();
  if (!db) return null;
  const { data: existing } = await db
    .from("decision_actions")
    .select("id, status, expected_action, actual_action")
    .eq("decision_id", opts.hit.decisionId)
    .maybeSingle();
  const merged = mergeActionRow(
    existing
      ? {
          expectedAction:
            (existing.expected_action as ExpectedAction) ??
            opts.hit.expectedAction ??
            "complete_planned_session",
          status: (existing.status as ActionStatus) ?? "pending",
          actualAction: (existing.actual_action as string | null) ?? null,
        }
      : null,
    {
      expectedAction: opts.hit.expectedAction ?? "complete_planned_session",
      status: opts.status,
      actualAction: opts.actualAction,
    },
  );
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    user_id: opts.userId,
    decision_id: opts.hit.decisionId,
    date: opts.date,
    expected_action: merged.expectedAction,
    actual_action: merged.actualAction,
    status: merged.status,
    updated_at: now,
  };
  if (opts.entityType) patch["entity_type"] = opts.entityType;
  if (opts.entityId) patch["entity_id"] = opts.entityId;
  if (merged.status === "started" || merged.status === "modified") {
    patch["started_at"] = now;
  }
  if (
    merged.status === "completed" ||
    merged.status === "skipped" ||
    merged.status === "rejected"
  ) {
    patch["completed_at"] = now;
  }
  const { data, error } = await db
    .from("decision_actions")
    .upsert(patch, { onConflict: "decision_id" })
    .select("id")
    .maybeSingle();
  if (error) {
    logEngineError({
      userId: opts.userId,
      engine: ATTRIBUTION_ENGINE,
      operation: "upsert_action",
      errorCode: "upsert_failed",
      message: error.message,
    });
    return (existing?.id as string | undefined) ?? null;
  }
  return (data?.id as string | undefined) ?? (existing?.id as string | undefined) ?? null;
}

async function upsertOutcomeForHit(opts: {
  userId: string;
  hit: AttributionHit;
  actionId: string | null;
  value: unknown;
  observedAt: string;
}): Promise<boolean> {
  const db = await adminDbLoose();
  if (!db) return false;
  const row: Record<string, unknown> = {
    decision_id: opts.hit.decisionId,
    user_id: opts.userId,
    outcome_type: opts.hit.outcomeType,
    value: opts.value,
    observed_at: opts.observedAt,
    outcome_window: opts.hit.outcomeWindow,
    attribution_type: opts.hit.attributionType,
    attribution_confidence: opts.hit.attributionConfidence,
    outcome_quality: opts.hit.outcomeQuality,
    learning_signal: opts.hit.learningSignal,
    metadata: {
      source: "attribution_v1",
      attribution_type: opts.hit.attributionType,
    },
  };
  if (opts.actionId) row["action_id"] = opts.actionId;
  const { error } = await db.from("decision_outcomes").upsert(row, {
    onConflict: "decision_id,outcome_type,outcome_window",
    ignoreDuplicates: true,
  });
  if (error && !String(error.message ?? "").includes("does not exist")) {
    logEngineError({
      userId: opts.userId,
      engine: ATTRIBUTION_ENGINE,
      operation: "upsert_outcome",
      errorCode: "upsert_failed",
      message: error.message,
    });
    return false;
  }
  return true;
}

async function dualWriteLegacy(opts: {
  userId: string;
  decisionId: string;
  outcome: string;
  metrics?: OutcomeMetrics | null;
  onlyUnset?: boolean;
}): Promise<void> {
  const db = await adminDbLoose();
  if (!db) return;
  const patch: Record<string, unknown> = { outcome: opts.outcome };
  if (opts.metrics != null) patch["outcome_metrics"] = opts.metrics;
  let q = db
    .from("recommendation_decisions")
    .update(patch)
    .eq("id", opts.decisionId)
    .eq("user_id", opts.userId);
  if (opts.onlyUnset !== false) q = q.is("outcome", null);
  await q;
}

export async function recordAttributedEvent(opts: {
  userId: string;
  date: string;
  actionKind: ActionKind;
  status: ActionStatus;
  window?: OutcomeWindow;
  extras?: AttributionExtras;
  entityType?: string;
  entityId?: string;
  metrics?: OutcomeMetrics | Record<string, unknown> | null;
  legacyOutcome?: string;
  onlyUnsetLegacy?: boolean;
}): Promise<{ ok: boolean; hits: AttributionHit[] }> {
  const t0 = Date.now();
  try {
    const rows = await loadDecisionRows(opts.userId, opts.date);
    const attrInput: Parameters<typeof attributeEvent>[0] = {
      actionKind: opts.actionKind,
      window: opts.window ?? "d0",
      decisions: refsFromRows(rows),
    };
    if (opts.extras) attrInput.extras = opts.extras;
    const hits = attributeEvent(attrInput);
    const observedAt = new Date().toISOString();
    for (const h of hits) {
      const actionInput: Parameters<typeof upsertActionForHit>[0] = {
        userId: opts.userId,
        date: opts.date,
        hit: h,
        status: opts.status,
        actualAction: opts.actionKind,
      };
      if (opts.entityType) actionInput.entityType = opts.entityType;
      if (opts.entityId) actionInput.entityId = opts.entityId;
      const actionId = await upsertActionForHit(actionInput);
      await upsertOutcomeForHit({
        userId: opts.userId,
        hit: h,
        actionId,
        value: opts.metrics ?? null,
        observedAt,
      });
      if (opts.legacyOutcome) {
        const legacy: Parameters<typeof dualWriteLegacy>[0] = {
          userId: opts.userId,
          decisionId: h.decisionId,
          outcome: opts.legacyOutcome,
        };
        if (opts.metrics != null) legacy.metrics = opts.metrics as OutcomeMetrics;
        if (opts.onlyUnsetLegacy !== undefined) legacy.onlyUnset = opts.onlyUnsetLegacy;
        await dualWriteLegacy(legacy);
      }
    }
    logEngineDecision({
      userId: opts.userId,
      date: opts.date,
      engine: ATTRIBUTION_ENGINE,
      decisionType: opts.actionKind,
      success: true,
      durationMs: Date.now() - t0,
      reason: `hits_${hits.length}`,
    });
    return { ok: true, hits };
  } catch (e) {
    logEngineError({
      userId: opts.userId,
      engine: ATTRIBUTION_ENGINE,
      operation: "record_event",
      errorCode: "record_failed",
      message: String(e),
    });
    return { ok: false, hits: [] };
  }
}

export async function sweepDelayedOutcomes(userId: string, today: string): Promise<void> {
  try {
    await recordAttributedEvent({
      userId,
      date: addDaysKey(today, -1),
      actionKind: "checkin_next_day",
      status: "completed",
      window: "d1",
    });
    await recordAttributedEvent({
      userId,
      date: addDaysKey(today, -3),
      actionKind: "delayed_recovery",
      status: "completed",
      window: "d3",
    });
    await recordAttributedEvent({
      userId,
      date: addDaysKey(today, -7),
      actionKind: "delayed_recovery",
      status: "completed",
      window: "d7",
    });
  } catch (e) {
    logEngineError({
      userId,
      engine: ATTRIBUTION_ENGINE,
      operation: "sweep_delayed",
      errorCode: "sweep_failed",
      message: String(e),
    });
  }
}

export async function explainDecisionAttribution(
  decisionId: string,
): Promise<AttributionExplanation | null> {
  try {
    const db = await adminDbLoose();
    if (!db || !decisionId) return null;
    const { data: decision } = await db
      .from("recommendation_decisions")
      .select("id, decision_type, decision_value, reason_codes")
      .eq("id", decisionId)
      .maybeSingle();
    if (!decision) return null;
    const { data: action } = await db
      .from("decision_actions")
      .select("expected_action, actual_action, status")
      .eq("decision_id", decisionId)
      .maybeSingle();
    const { data: outcomes } = await db
      .from("decision_outcomes")
      .select(
        "outcome_type, observed_at, outcome_window, attribution_type, attribution_confidence, learning_signal, outcome_quality",
      )
      .eq("decision_id", decisionId)
      .order("observed_at", { ascending: false })
      .limit(1);
    const outcome = (outcomes ?? [])[0] as
      | {
          outcome_type?: string;
          observed_at?: string;
          outcome_window?: string;
          attribution_type?: string;
          attribution_confidence?: number | null;
          learning_signal?: string | null;
          outcome_quality?: string;
        }
      | undefined;
    const dv = (decision as { decision_value?: { value?: unknown } }).decision_value?.value;
    return explainAttributionFromParts({
      reasonCodes: ((decision as { reason_codes?: string[] }).reason_codes ?? []) as string[],
      expectedAction:
        (action?.expected_action as string | null) ??
        expectedActionForDecision({
          decisionType: String((decision as { decision_type?: string }).decision_type ?? ""),
          decisionValue: dv ?? null,
        }),
      actualAction: (action?.actual_action as string | null) ?? null,
      actionStatus: (action?.status as ActionStatus | null) ?? null,
      outcomeType: outcome?.outcome_type ?? null,
      observedAt: outcome?.observed_at ?? null,
      outcomeWindow: (outcome?.outcome_window as OutcomeWindow | null) ?? null,
      attributionType:
        (outcome?.attribution_type as AttributionExplanation["attributionType"]) ?? null,
      attributionConfidence:
        outcome?.attribution_confidence != null ? Number(outcome.attribution_confidence) : null,
      learningSignal: ((): LearningSignal | null => {
        const raw = outcome?.learning_signal;
        return typeof raw === "string" && isLearningSignal(raw) ? raw : null;
      })(),
      outcomeQuality: (outcome?.outcome_quality as OutcomeQuality | undefined) ?? "unknown",
    });
  } catch (e) {
    logEngineError({
      engine: ATTRIBUTION_ENGINE,
      operation: "explain_attribution",
      errorCode: "explain_failed",
      message: String(e),
    });
    return null;
  }
}

export function nextStatusForKind(kind: ActionKind): ActionStatus {
  if (kind.endsWith("skipped") || kind === "living_plan_skipped") return "skipped";
  if (kind.includes("started") || kind === "living_plan_started" || kind === "workout_started") {
    return "started";
  }
  return "completed";
}
