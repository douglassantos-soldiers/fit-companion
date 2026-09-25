/**
 * Reserved agent ids (Coach + Specialists).
 */

/** Reserved agent id for the product Coach Agent. */
export const COACH_AGENT_ID = "coach" as const;

export const SPECIALIST_PERFORMANCE_ID = "specialist_performance" as const;
export const SPECIALIST_TRAINING_ID = "specialist_training" as const;
export const SPECIALIST_NUTRITION_ID = "specialist_nutrition" as const;
export const SPECIALIST_RECOVERY_ID = "specialist_recovery" as const;
export const SPECIALIST_BEHAVIOR_ID = "specialist_behavior" as const;

/** All specialist agent ids (5). */
export const SPECIALIST_AGENT_IDS = [
  SPECIALIST_PERFORMANCE_ID,
  SPECIALIST_TRAINING_ID,
  SPECIALIST_NUTRITION_ID,
  SPECIALIST_RECOVERY_ID,
  SPECIALIST_BEHAVIOR_ID,
] as const;

export type SpecialistAgentId = (typeof SPECIALIST_AGENT_IDS)[number];
