/**
 * Evaluate decision interventions vs real outcomes (FASE 5).
 * Rule-based — no ML.
 */
import {
  applyOutcomeToPattern,
  type LearnedPattern,
  type PatternKind,
} from "@/lib/engine/learned-patterns";
import {
  applyBehaviorOutcome,
  type BehaviorProfile,
  type InterventionType,
} from "@/lib/engine/behavior";
import type { DayCheckIn, DayEnergy, SessionRpe } from "@/lib/types";
import {
  shouldLearnFromAttribution,
  type AttributionType,
  type OutcomeQuality,
} from "@/lib/engine/attribution";

export type OutcomeMetrics = {
  workoutCompleted?: boolean;
  rpe?: SessionRpe | null;
  nextDayEnergy?: DayEnergy | null;
  nextDaySleep?: number | null;
  volumeFactor?: number | null;
  sessionDurationMin?: number | null;
};

export type InterventionEvaluation = {
  kind: PatternKind;
  result: "success" | "fail" | "inconclusive";
  note: string;
};

export function evaluateVolumeReductionOutcome(opts: {
  volumeFactor: number;
  workoutCompleted: boolean;
  rpe?: SessionRpe | null;
  nextDayEnergy?: DayEnergy | null;
}): InterventionEvaluation {
  const { volumeFactor, workoutCompleted, rpe, nextDayEnergy } = opts;
  if (volumeFactor >= 0.95) {
    return {
      kind: "volume_reduction_helps",
      result: "inconclusive",
      note: "Sem redução de volume relevante.",
    };
  }
  if (!workoutCompleted) {
    return {
      kind: "volume_reduction_helps",
      result: "fail",
      note: "Volume reduzido mas treino não concluído.",
    };
  }
  if (nextDayEnergy === "alta" || nextDayEnergy === "ok") {
    if (rpe !== "dificil") {
      return {
        kind: "volume_reduction_helps",
        result: "success",
        note: `Volume ${Math.round(volumeFactor * 100)}% + RPE ${rpe ?? "ok"} + energia D+1 ${nextDayEnergy}.`,
      };
    }
  }
  if (nextDayEnergy === "baixa" && rpe === "dificil") {
    return {
      kind: "volume_reduction_helps",
      result: "fail",
      note: "Mesmo com volume↓, RPE difícil e energia D+1 baixa.",
    };
  }
  if (nextDayEnergy == null) {
    return {
      kind: "volume_reduction_helps",
      result: "inconclusive",
      note: "Aguardando check-in do dia seguinte.",
    };
  }
  return {
    kind: "volume_reduction_helps",
    result: "inconclusive",
    note: "Sinais mistos após redução de volume.",
  };
}

export function evaluateShortSessionOutcome(opts: {
  sessionDurationMin: number;
  workoutCompleted: boolean;
  rpe?: SessionRpe | null;
}): InterventionEvaluation {
  if (opts.sessionDurationMin >= 45) {
    return {
      kind: "prefers_short_sessions",
      result: "inconclusive",
      note: "Sessão não foi curta.",
    };
  }
  if (opts.workoutCompleted && opts.rpe !== "dificil") {
    return {
      kind: "prefers_short_sessions",
      result: "success",
      note: `Sessão curta (${opts.sessionDurationMin} min) concluída com RPE ${opts.rpe ?? "ok"}.`,
    };
  }
  if (!opts.workoutCompleted) {
    return {
      kind: "prefers_short_sessions",
      result: "fail",
      note: "Sessão curta não concluída.",
    };
  }
  return {
    kind: "prefers_short_sessions",
    result: "inconclusive",
    note: "Sessão curta com RPE difícil.",
  };
}

export function applyEvaluationsToPatterns(
  patterns: LearnedPattern[],
  evaluations: InterventionEvaluation[],
  date: string,
): LearnedPattern[] {
  let next = patterns;
  for (const ev of evaluations) {
    if (ev.result === "inconclusive") continue;
    next = applyOutcomeToPattern(next, ev.kind, ev.result, date, ev.note);
  }
  return next;
}

export function applyAttributedEvaluationsToPatterns(
  patterns: LearnedPattern[],
  items: Array<{
    evaluation: InterventionEvaluation;
    attributionType: AttributionType;
    attributionConfidence: number;
    outcomeQuality: OutcomeQuality;
  }>,
  date: string,
): LearnedPattern[] {
  const evals = items
    .filter((item) =>
      shouldLearnFromAttribution({
        attributionType: item.attributionType,
        attributionConfidence: item.attributionConfidence,
        outcomeQuality: item.outcomeQuality,
      }),
    )
    .map((item) => item.evaluation);
  return applyEvaluationsToPatterns(patterns, evals, date);
}

export function metricsFromSessionAndCheckIn(opts: {
  completed: boolean;
  rpe?: SessionRpe | null;
  durationMin?: number;
  volumeFactor?: number | null;
  nextDay?: DayCheckIn | null;
}): OutcomeMetrics {
  return {
    workoutCompleted: opts.completed,
    rpe: opts.rpe ?? null,
    sessionDurationMin: opts.durationMin ?? null,
    volumeFactor: opts.volumeFactor ?? null,
    nextDayEnergy: opts.nextDay?.energy ?? null,
    nextDaySleep: opts.nextDay?.sleepHours ?? null,
  };
}

export function patternKeyFromEvaluation(ev: InterventionEvaluation): string {
  if (ev.kind === "volume_reduction_helps" && ev.result === "success") {
    return "USER_RESPONDS_WELL_TO_VOLUME_REDUCTION_UNDER_LOW_RECOVERY";
  }
  if (ev.kind === "prefers_short_sessions" && ev.result === "success") {
    return "EXPRESS_WORKOUT_HAS_HIGHER_ADHERENCE_WHEN_TIME_CONSTRAINED";
  }
  return "";
}

/** Bridge outcome → Behavior Engine interventionResponse + optional DB row. */
export function interventionTypeFromEvaluation(
  ev: InterventionEvaluation,
): InterventionType | null {
  if (ev.kind === "prefers_short_sessions") return "express_workout";
  if (ev.kind === "volume_reduction_helps") return "micro_goal";
  return null;
}

export function applyBehaviorOutcomeFromEvaluations(
  profile: BehaviorProfile,
  evaluations: InterventionEvaluation[],
): BehaviorProfile {
  let next = profile;
  for (const ev of evaluations) {
    if (ev.result === "inconclusive") continue;
    const type = interventionTypeFromEvaluation(ev);
    if (!type) continue;
    next = applyBehaviorOutcome(next, type, ev.result === "success");
  }
  return next;
}

export async function recordBehaviorOutcomeBestEffort(opts: {
  userId?: string | null;
  interventionId?: string | null;
  success: boolean;
  metrics?: Record<string, unknown>;
}): Promise<void> {
  if (!opts.userId) return;
  try {
    const { recordBehaviorOutcome } = await import("@/lib/engine/behavior/persist.server");
    await recordBehaviorOutcome({
      userId: opts.userId,
      success: opts.success,
      ...(opts.interventionId !== undefined ? { interventionId: opts.interventionId } : {}),
      ...(opts.metrics !== undefined ? { metrics: opts.metrics } : {}),
    });
  } catch {
    /* best-effort */
  }
}
