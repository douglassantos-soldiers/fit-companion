/**
 * Performance OS canonical decision types (Phase 5).
 * Engine DecisionType (snake) maps here for log + Coach presentation.
 */

export const PERFORMANCE_DECISION_TYPES = [
  "WORKOUT_MODE",
  "TRAINING_VOLUME",
  "TRAINING_LOAD",
  "EXERCISE_SELECTION",
  "REST",
  "MEAL_PRIORITY",
  "NUTRITION_TARGET",
  "SUPPLEMENT_ACTION",
  "SLEEP_PRIORITY",
  "BEHAVIOR_INTERVENTION",
  "COACH_CHECKIN",
  "DELOAD",
  "PROGRESSION",
  "PLATEAU_RESPONSE",
] as const;

export type PerformanceDecisionType = (typeof PERFORMANCE_DECISION_TYPES)[number];

/** Legacy engine DecisionType strings persisted before Phase 5. */
export type LegacyEngineDecisionType =
  | "training_mode"
  | "training_volume"
  | "session_duration"
  | "nutrition_calorie_delta"
  | "nutrition_protein_bias"
  | "meal_distribution"
  | "block_stims"
  | "primary_action";

const ENGINE_TO_CANONICAL: Record<string, PerformanceDecisionType> = {
  training_mode: "WORKOUT_MODE",
  training_volume: "TRAINING_VOLUME",
  session_duration: "TRAINING_LOAD",
  nutrition_calorie_delta: "NUTRITION_TARGET",
  nutrition_protein_bias: "NUTRITION_TARGET",
  meal_distribution: "MEAL_PRIORITY",
  block_stims: "SLEEP_PRIORITY",
  primary_action: "WORKOUT_MODE",
  behavior_intervention: "BEHAVIOR_INTERVENTION",
  plateau_response: "PLATEAU_RESPONSE",
  progression: "PROGRESSION",
};

const CANONICAL_TO_ENGINE: Partial<Record<PerformanceDecisionType, LegacyEngineDecisionType>> = {
  WORKOUT_MODE: "training_mode",
  TRAINING_VOLUME: "training_volume",
  TRAINING_LOAD: "session_duration",
  NUTRITION_TARGET: "nutrition_protein_bias",
  MEAL_PRIORITY: "meal_distribution",
  SLEEP_PRIORITY: "block_stims",
  REST: "training_mode",
  DELOAD: "training_mode",
};

export function isPerformanceDecisionType(raw: string): raw is PerformanceDecisionType {
  return (PERFORMANCE_DECISION_TYPES as readonly string[]).includes(raw);
}

export function engineTypeToCanonical(engineType: string): PerformanceDecisionType {
  if (isPerformanceDecisionType(engineType)) return engineType;
  const mapped = ENGINE_TO_CANONICAL[engineType as LegacyEngineDecisionType];
  return mapped ?? "WORKOUT_MODE";
}

export function canonicalToEngineType(
  canonical: PerformanceDecisionType,
): LegacyEngineDecisionType {
  return CANONICAL_TO_ENGINE[canonical] ?? "primary_action";
}

/** Map workout mode value → more specific canonical when useful. */
export function refineWorkoutModeCanonical(
  mode: string,
): PerformanceDecisionType {
  if (mode === "rest") return "REST";
  if (mode === "deload") return "DELOAD";
  return "WORKOUT_MODE";
}

export type AuthoritativeLike =
  | "REST"
  | "REDUCE_VOLUME"
  | "EXPRESS_WORKOUT"
  | "FULL_WORKOUT"
  | "DELOAD"
  | "INCREASE_RECOVERY"
  | "NUTRITION_FOCUS"
  | "HYDRATION_FOCUS"
  | "SUPPLEMENT_REMINDER"
  | "SLEEP_PRIORITY"
  | "COACH_CHECKIN";

export function authoritativeToCanonical(t: AuthoritativeLike): PerformanceDecisionType {
  switch (t) {
    case "REST":
      return "REST";
    case "REDUCE_VOLUME":
      return "TRAINING_VOLUME";
    case "EXPRESS_WORKOUT":
    case "FULL_WORKOUT":
      return "WORKOUT_MODE";
    case "DELOAD":
      return "DELOAD";
    case "INCREASE_RECOVERY":
    case "SLEEP_PRIORITY":
      return "SLEEP_PRIORITY";
    case "NUTRITION_FOCUS":
    case "HYDRATION_FOCUS":
      return "NUTRITION_TARGET";
    case "SUPPLEMENT_REMINDER":
      return "SUPPLEMENT_ACTION";
    case "COACH_CHECKIN":
      return "COACH_CHECKIN";
    default:
      return "WORKOUT_MODE";
  }
}
