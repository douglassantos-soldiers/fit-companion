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

export const logDecisionsFn = createServerFn({ method: "POST" })
  .inputValidator(parseLog)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId });
    if (!identity?.userId) return { ok: false };
    const { logRecommendationDecisions } = await import("@/lib/decision-log.server");
    return logRecommendationDecisions({
      userId: identity.userId,
      date: data.date,
      decisions: data.decisions,
      snapshot: data.snapshot,
    });
  });

export const markDecisionOutcomeFn = createServerFn({ method: "POST" })
  .inputValidator(parseOutcome)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId });
    if (!identity?.userId) return { ok: false };
    const { markDecisionOutcomes } = await import("@/lib/decision-log.server");
    return markDecisionOutcomes({
      userId: identity.userId,
      date: data.date,
      outcome: data.outcome,
      outcomeMetrics: data.outcomeMetrics,
      onlyUnset: data.onlyUnset,
    });
  });

/** Session completed → outcome + metrics; bump prefers_short if applicable. */
export const recordSessionOutcomeFn = createServerFn({ method: "POST" })
  .inputValidator(parseSessionOutcome)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId });
    if (!identity?.userId) return { ok: false };

    const { metricsFromSessionAndCheckIn, evaluateShortSessionOutcome, applyEvaluationsToPatterns } =
      await import("@/lib/engine/outcome-learning");
    const metrics = metricsFromSessionAndCheckIn({
      completed: true,
      rpe: data.rpe,
      durationMin: data.durationMin,
      volumeFactor: data.volumeFactor,
    });

    const { markDecisionOutcomes } = await import("@/lib/decision-log.server");
    await markDecisionOutcomes({
      userId: identity.userId,
      date: data.date,
      outcome: "session_completed",
      outcomeMetrics: metrics,
      onlyUnset: true,
    });

    // Learning: short session success (immediate, no D+1 needed)
    if (data.durationMin != null && data.durationMin < 45) {
      const { loadPatternsBlob, savePatternsBlob } = await import(
        "@/lib/engine/learning-patterns.server"
      );
      const prior = await loadPatternsBlob(identity.userId);
      const ev = evaluateShortSessionOutcome({
        sessionDurationMin: data.durationMin,
        workoutCompleted: true,
        rpe: data.rpe,
      });
      if (ev.result !== "inconclusive") {
        const nextPatterns = applyEvaluationsToPatterns(
          prior?.patterns ?? [],
          [ev],
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
      }
    }

    return { ok: true };
  });

/** Check-in D+1 → attach energy/sleep to yesterday's decisions + volume_reduction_helps. */
export const recordNextDayCheckInOutcomeFn = createServerFn({ method: "POST" })
  .inputValidator(parseNextDay)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId });
    if (!identity?.userId) return { ok: false };

    const metrics: OutcomeMetrics = {
      nextDayEnergy: data.energy ?? data.checkIn?.energy ?? null,
      nextDaySleep: data.sleepHours ?? data.checkIn?.sleepHours ?? null,
    };

    const { appendOutcomeMetrics, loadDecisionsForDate } = await import(
      "@/lib/decision-log.server"
    );
    const { volumeReduced } = await appendOutcomeMetrics({
      userId: identity.userId,
      date: data.yesterday,
      metrics,
    });

    if (!volumeReduced) return { ok: true, learned: false };

    const rows = await loadDecisionsForDate({
      userId: identity.userId,
      date: data.yesterday,
    });
    const volRow = rows.find((r) => r.decision_type === "training_volume");
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

    const { evaluateVolumeReductionOutcome, applyEvaluationsToPatterns } = await import(
      "@/lib/engine/outcome-learning"
    );
    const ev = evaluateVolumeReductionOutcome({
      volumeFactor,
      workoutCompleted: Boolean(completed),
      rpe,
      nextDayEnergy: metrics.nextDayEnergy ?? null,
    });

    if (ev.result === "inconclusive") return { ok: true, learned: false };

    const { loadPatternsBlob, savePatternsBlob } = await import(
      "@/lib/engine/learning-patterns.server"
    );
    const prior = await loadPatternsBlob(identity.userId);
    const nextPatterns = applyEvaluationsToPatterns(
      prior?.patterns ?? [],
      [ev],
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
