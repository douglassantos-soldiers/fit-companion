/**
 * Behavior profile — scores 0–1 + confidence (no clinical labels).
 */
import {
  consistencyScore,
  mealAdherence7d,
  sleepBehavior7d,
  trainingAdherence7d,
} from "@/lib/engine/behavior/adherence";
import type {
  BehaviorProfile,
  InterventionType,
} from "@/lib/engine/behavior/types";
import { extractUserPatterns } from "@/lib/engine/user-patterns";
import type { AppState } from "@/lib/types";

export function buildBehaviorProfile(
  state: AppState,
  interventionResponse: Partial<Record<InterventionType, number>> = {},
): BehaviorProfile {
  const consistency = consistencyScore(state);
  const mealAdherence = mealAdherence7d(state);
  const trainingAdherence = trainingAdherence7d(state);
  const sleepBehavior = sleepBehavior7d(state);
  const legacy = extractUserPatterns(state);
  const weekendPattern = legacy.mealGapWeekend ? 0.35 : 0.7;
  const timeConstraintBehavior = legacy.longWorkoutAvoidance ? 0.8 : 0.45;

  const samples =
    (state.sessions?.length ?? 0) +
    (state.meals?.length ?? 0) +
    Object.keys(state.dayCheckIns ?? {}).length;
  const confidence = Math.min(0.9, 0.25 + samples * 0.02);

  return {
    consistency,
    mealAdherence,
    trainingAdherence,
    sleepBehavior,
    weekendPattern,
    timeConstraintBehavior,
    interventionResponse,
    confidence: Math.round(confidence * 100) / 100,
  };
}
