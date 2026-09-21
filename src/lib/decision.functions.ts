/**
 * Server fns for Decision Engine log (FASE 4 + FASE 5 outcomes).
 */
import { createServerFn } from "@tanstack/react-start";
import type { EngineDecision } from "@/lib/engine/decision";
import type { ContextSnapshot } from "@/lib/engine/context-snapshot";
import type { OutcomeMetrics } from "@/lib/engine/outcome-learning";
import type { DayCheckIn, DayEnergy, SessionRpe } from "@/lib/types";

function parseLog(input: unknown) {
  const v = input as {
    deviceId?: string;
    date?: string;
    decisions?: EngineDecision[];
    snapshot?: ContextSnapshot;
  } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const date = String(v?.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date inválida");
  if (!Array.isArray(v?.decisions) || !v.decisions.length) throw new Error("decisions obrigatório");
  if (!v.snapshot || typeof v.snapshot !== "object") throw new Error("snapshot obrigatório");
  return {
    deviceId,
    date,
    decisions: v.decisions,
    snapshot: v.snapshot,
  };
}

function parseOutcome(input: unknown) {
  const v = input as {
    deviceId?: string;
    date?: string;
    outcome?: string;
    outcomeMetrics?: OutcomeMetrics | null;
    onlyUnset?: boolean;
  } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const date = String(v?.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date inválida");
  const outcome = String(v?.outcome ?? "").trim();
  if (!outcome) throw new Error("outcome obrigatório");
  return {
    deviceId,
    date,
    outcome,
    outcomeMetrics: v?.outcomeMetrics ?? null,
    onlyUnset: v?.onlyUnset,
  };
}

function parseNextDay(input: unknown) {
  const v = input as {
    deviceId?: string;
    yesterday?: string;
    energy?: DayEnergy;
    sleepHours?: number;
    checkIn?: DayCheckIn;
  } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const yesterday = String(v?.yesterday ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yesterday)) throw new Error("yesterday inválida");
  return {
    deviceId,
    yesterday,
    energy: v?.energy,
    sleepHours: v?.sleepHours,
    checkIn: v?.checkIn,
  };
}

function parseSessionOutcome(input: unknown) {
  const v = input as {
    deviceId?: string;
    date?: string;
    rpe?: SessionRpe | null;
    durationMin?: number;
    volumeFactor?: number | null;
    express?: boolean;
  } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const date = String(v?.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date inválida");
  return {
    deviceId,
    date,
    rpe: v?.rpe ?? null,
    durationMin: v?.durationMin,
    volumeFactor: v?.volumeFactor ?? null,
    express: Boolean(v?.express),
  };
}

function parseGetContext(input: unknown) {
  const v = input as { deviceId?: string; date?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const rawDate = v?.date != null ? String(v.date).slice(0, 10) : "";
  if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) throw new Error("date inválida");
  return rawDate ? { deviceId, date: rawDate } : { deviceId };
}

function parseAction(input: unknown) {
  const v = input as {
    deviceId?: string;
    date?: string;
    actionKind?: string;
    status?: string;
    entityType?: string;
    entityId?: string;
    mealSlot?: string;
    primaryKind?: "train" | "rest" | "sleep" | "meal";
    express?: boolean;
  } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const date = String(v?.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date inválida");
  const actionKind = String(v?.actionKind ?? "").trim();
  if (!actionKind) throw new Error("actionKind obrigatório");
  return {
    deviceId,
    date,
    actionKind,
    ...(v?.status ? { status: String(v.status) } : {}),
    ...(v?.entityType ? { entityType: String(v.entityType) } : {}),
    ...(v?.entityId ? { entityId: String(v.entityId) } : {}),
    ...(v?.mealSlot ? { mealSlot: String(v.mealSlot) } : {}),
    ...(v?.primaryKind ? { primaryKind: v.primaryKind } : {}),
    ...(v?.express != null ? { express: Boolean(v.express) } : {}),
  };
}

export const getDecisionContextFn = createServerFn({ method: "POST" })
  .inputValidator(parseGetContext)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
    if (!identity?.userId) return { ok: false as const, snapshot: null };
    const { getOrBuildDecisionContext } = await import("@/lib/engine/decision-context.server");
    const built = await getOrBuildDecisionContext(identity.userId, data.date);
    return { ok: true as const, snapshot: built?.snapshot ?? null };
  });

export const logDecisionsFn = createServerFn({ method: "POST" })
  .inputValidator(parseLog)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
    if (!identity?.userId) return { ok: false };
    // Ignore client-computed decisions — server is the authority.
    const { getOrBuildDecisionContext } = await import("@/lib/engine/decision-context.server");
    const built = await getOrBuildDecisionContext(identity.userId, data.date);
    return { ok: Boolean(built?.snapshot) };
  });

export const recordDecisionActionFn = createServerFn({ method: "POST" })
  .inputValidator(parseAction)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
    if (!identity?.userId) return { ok: false as const, hits: 0 };
    const { recordAttributedEvent } = await import("@/lib/engine/attribution.server");
    const attr = await import("@/lib/engine/attribution");
    const mapped = attr.actionKindFromLegacyOutcome(data.actionKind);
    const actionKind = (mapped?.actionKind ??
      data.actionKind) as import("@/lib/engine/attribution").ActionKind;
    const status = (data.status ??
      mapped?.status ??
      "completed") as import("@/lib/engine/attribution").ActionStatus;
    const extras: import("@/lib/engine/attribution").AttributionExtras = {};
    if (data.mealSlot) extras.mealSlot = data.mealSlot;
    if (data.primaryKind) extras.primaryKind = data.primaryKind;
    if (data.express != null) extras.express = data.express;
    const event: Parameters<typeof recordAttributedEvent>[0] = {
      userId: identity.userId,
      date: data.date,
      actionKind,
      status,
      extras,
    };
    if (data.entityType) event.entityType = data.entityType;
    if (data.entityId) event.entityId = data.entityId;
    const res = await recordAttributedEvent(event);
    return { ok: res.ok, hits: res.hits.length };
  });

export const markDecisionOutcomeFn = createServerFn({ method: "POST" })
  .inputValidator(parseOutcome)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
    if (!identity?.userId) return { ok: false };
    const { markDecisionOutcomes } = await import("@/lib/decision-log.server");
    const payload: Parameters<typeof markDecisionOutcomes>[0] = {
      userId: identity.userId,
      date: data.date,
      outcome: data.outcome,
    };
    if (data.outcomeMetrics !== undefined) payload.outcomeMetrics = data.outcomeMetrics;
    if (data.onlyUnset !== undefined) payload.onlyUnset = data.onlyUnset;
    return markDecisionOutcomes(payload);
  });

/** Session completed → outcome + metrics; bump prefers_short if applicable. */
export const recordSessionOutcomeFn = createServerFn({ method: "POST" })
  .inputValidator(parseSessionOutcome)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
    if (!identity?.userId) return { ok: false };

    const { metricsFromSessionAndCheckIn, evaluateShortSessionOutcome } =
      await import("@/lib/engine/outcome-learning");
    const metricOpts: Parameters<typeof metricsFromSessionAndCheckIn>[0] = {
      completed: true,
      rpe: data.rpe,
      volumeFactor: data.volumeFactor,
    };
    if (data.durationMin != null) metricOpts.durationMin = data.durationMin;
    const metrics = metricsFromSessionAndCheckIn(metricOpts);

    const { recordAttributedEvent } = await import("@/lib/engine/attribution.server");
    const extras: import("@/lib/engine/attribution").AttributionExtras = {
      workoutCompleted: true,
      express: data.express,
    };
    if (data.rpe !== undefined) extras.rpe = data.rpe ?? null;
    if (data.durationMin != null) extras.sessionDurationMin = data.durationMin;
    if (data.volumeFactor != null && data.volumeFactor < 1) extras.volumeReduced = true;
    const attributed = await recordAttributedEvent({
      userId: identity.userId,
      date: data.date,
      actionKind: "session_completed",
      status: "completed",
      extras,
      metrics,
      legacyOutcome: "session_completed",
      onlyUnsetLegacy: true,
    });

    const { shouldLearnFromAttribution, patternKindFromLearningSignal } =
      await import("@/lib/engine/attribution");
    const { applyAttributedEvaluationsToPatterns } = await import("@/lib/engine/outcome-learning");

    // Learning: short session success only when WORKOUT_MODE (or behavior) attribution is valid
    if (data.durationMin != null && data.durationMin < 45) {
      const ev = evaluateShortSessionOutcome({
        sessionDurationMin: data.durationMin,
        workoutCompleted: true,
        rpe: data.rpe,
      });
      const gated = attributed.hits
        .filter(
          (h) =>
            patternKindFromLearningSignal(h.learningSignal) === "prefers_short_sessions" &&
            shouldLearnFromAttribution(h),
        )
        .map((h) => ({
          evaluation: ev,
          attributionType: h.attributionType,
          attributionConfidence: h.attributionConfidence,
          outcomeQuality: h.outcomeQuality,
        }));
      if (ev.result !== "inconclusive" && gated.length) {
        const { loadPatternsBlob, savePatternsBlob } =
          await import("@/lib/engine/learning-patterns.server");
        const prior = await loadPatternsBlob(identity.userId);
        const nextPatterns = applyAttributedEvaluationsToPatterns(
          prior?.patterns ?? [],
          gated,
          data.date,
        );
        await savePatternsBlob(identity.userId, {
          version: 2,
          legacy: prior?.legacy ?? {
            weekdaySessionCounts: {},
            weakestWeekday: null,
            mealGapWeekend: false,
            longWorkoutAvoidance: false,
            updatedAt: new Date().toISOString(),
          },
          patterns: nextPatterns,
        });

        try {
          const { applyBehaviorOutcomeFromEvaluations, recordBehaviorOutcomeBestEffort } =
            await import("@/lib/engine/outcome-learning");
          const { buildBehaviorProfile } = await import("@/lib/engine/behavior");
          const { hydrateAppStateFromDb } = await import("@/lib/customer360/hydrate.server");
          const state = await hydrateAppStateFromDb(identity.userId);
          const profile = buildBehaviorProfile(state);
          applyBehaviorOutcomeFromEvaluations(profile, [ev]);
          await recordBehaviorOutcomeBestEffort({
            userId: identity.userId,
            success: ev.result === "success",
            metrics: {
              kind: data.express || (data.durationMin ?? 99) < 35 ? "express" : "workout",
              durationMin: data.durationMin,
              evaluation: ev.kind,
              result: ev.result,
              decisionId:
                attributed.hits.find((h) => h.decisionType === "BEHAVIOR_INTERVENTION")
                  ?.decisionId ?? attributed.hits[0]?.decisionId,
            },
          });
        } catch {
          /* best-effort */
        }
      }
    }

    return { ok: true };
  });

/** Check-in D+1 → attach energy/sleep to yesterday's decisions + volume_reduction_helps. */
export const recordNextDayCheckInOutcomeFn = createServerFn({ method: "POST" })
  .inputValidator(parseNextDay)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
    if (!identity?.userId) return { ok: false };

    const metrics: OutcomeMetrics = {
      nextDayEnergy: data.energy ?? data.checkIn?.energy ?? null,
      nextDaySleep: data.sleepHours ?? data.checkIn?.sleepHours ?? null,
    };

    const { appendOutcomeMetrics, loadDecisionsForDate } =
      await import("@/lib/decision-log.server");
    const { volumeReduced, hits } = await appendOutcomeMetrics({
      userId: identity.userId,
      date: data.yesterday,
      metrics,
    });

    if (!volumeReduced) return { ok: true, learned: false };

    const { shouldLearnFromAttribution, patternKindFromLearningSignal } =
      await import("@/lib/engine/attribution");
    const volumeHits = hits.filter(
      (h) =>
        h.decisionType === "TRAINING_VOLUME" &&
        patternKindFromLearningSignal(h.learningSignal) === "volume_reduction_helps" &&
        shouldLearnFromAttribution(h),
    );
    if (!volumeHits.length) return { ok: true, learned: false };

    const rows = await loadDecisionsForDate({
      userId: identity.userId,
      date: data.yesterday,
    });
    const volRow = rows.find(
      (r) => r.decision_type === "training_volume" || r.decision_type === "TRAINING_VOLUME",
    );
    const volumeFactor =
      typeof volRow?.decision_value?.value === "number"
        ? volRow.decision_value.value
        : typeof volRow?.outcome_metrics?.volumeFactor === "number"
          ? volRow.outcome_metrics.volumeFactor
          : null;
    if (volumeFactor == null || volumeFactor >= 0.95) return { ok: true, learned: false };

    const completed =
      volRow?.outcome === "session_completed" ||
      volRow?.outcome_metrics?.workoutCompleted === true ||
      rows.some((r) => r.outcome === "session_completed");

    const rpe = (volRow?.outcome_metrics?.rpe ?? null) as SessionRpe | null;

    const { evaluateVolumeReductionOutcome, applyAttributedEvaluationsToPatterns } =
      await import("@/lib/engine/outcome-learning");
    const ev = evaluateVolumeReductionOutcome({
      volumeFactor,
      workoutCompleted: Boolean(completed),
      rpe,
      nextDayEnergy: metrics.nextDayEnergy ?? null,
    });

    if (ev.result === "inconclusive") return { ok: true, learned: false };

    const { loadPatternsBlob, savePatternsBlob } =
      await import("@/lib/engine/learning-patterns.server");
    const prior = await loadPatternsBlob(identity.userId);
    const nextPatterns = applyAttributedEvaluationsToPatterns(
      prior?.patterns ?? [],
      volumeHits.map((h) => ({
        evaluation: ev,
        attributionType: h.attributionType,
        attributionConfidence: h.attributionConfidence,
        outcomeQuality: h.outcomeQuality,
      })),
      data.yesterday,
    );
    await savePatternsBlob(identity.userId, {
      version: 2,
      legacy: prior?.legacy ?? {
        weekdaySessionCounts: {},
        weakestWeekday: null,
        mealGapWeekend: false,
        longWorkoutAvoidance: false,
        updatedAt: new Date().toISOString(),
      },
      patterns: nextPatterns,
    });

    return { ok: true, learned: true };
  });
