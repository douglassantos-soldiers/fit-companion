import { streak } from "@/lib/engine/dimensions";
import { runBehaviorLoop } from "@/lib/engine/behavior";
import {
  mealAdherence7d,
  sleepBehavior7d,
  trainingAdherence7d,
} from "@/lib/engine/behavior/adherence";
import type { AppState } from "@/lib/types";
import type { Behavior360 } from "@/lib/customer360/types";

export function aggregateBehavior(state: AppState): Behavior360 {
  const logDays = Object.values(state.supplementLogs ?? {}).filter((ids) => ids.length > 0).length;
  const loop = runBehaviorLoop(state);
  const activeTriggers = loop.triggers.filter((t) => t.active);
  const engagement = Math.min(
    1,
    (state.sessions.length + (state.meals ?? []).length + (state.chat ?? []).length) / 40,
  );

  return {
    workoutsCompleted: state.sessions.length,
    mealsLogged: (state.meals ?? []).length,
    weightLogs: state.weights.length,
    supplementDays: logDays,
    coachMessages: (state.chat ?? []).length,
    streak: streak(state.sessions, { freezeUsedDates: state.freezeUsedDates }),
    patterns: loop.patterns.slice(0, 8).map((p) => ({
      key: p.key,
      confidence: p.confidence,
      supportCount: p.supportCount,
    })),
    triggerCount: activeTriggers.length,
    interventionCount: loop.interventions.length,
    successfulInterventionCount: Object.values(loop.profile.interventionResponse).filter(
      (r) => (r ?? 0) >= 0.6,
    ).length,
    engagement: Math.round(engagement * 100) / 100,
    adherence: {
      training: trainingAdherence7d(state),
      meal: mealAdherence7d(state),
      sleep: sleepBehavior7d(state),
    },
    behaviorConfidence: loop.profile.confidence,
  };
}
