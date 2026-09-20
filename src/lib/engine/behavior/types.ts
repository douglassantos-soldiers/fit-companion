/**
 * Behavior Engine types (Phase 4).
 * No psychological diagnoses — behavioral signals + micro-interventions only.
 */

export type BehaviorPatternKey =
  | "weak_weekday"
  | "weekend_meal_gap"
  | "long_workout_avoidance"
  | "prefers_short_sessions"
  | "weekday_skip"
  | "volume_reduction_helps"
  | "low_friday_training"
  | "meal_logging_drop"
  | "sleep_debt";

export type BehaviorTriggerKey =
  | "LOW_FRIDAY_ADHERENCE"
  | "LOW_SLEEP_STREAK"
  | "MEAL_LOGGING_DROP"
  | "TRAINING_SKIPPING_PATTERN"
  | "WEEKEND_MEAL_GAP"
  | "TIME_CONSTRAINT_PATTERN";

export type InterventionType =
  | "reminder"
  | "micro_goal"
  | "express_workout"
  | "meal_swap"
  | "sleep_prompt"
  | "hydration_prompt"
  | "coach_checkin"
  | "environment_prompt";

export type BehaviorPatternStatus = "candidate" | "active" | "decayed";

export interface BehaviorEvidence {
  date: string;
  note: string;
}

export interface BehaviorPattern {
  key: BehaviorPatternKey;
  description: string;
  evidence: BehaviorEvidence[];
  confidence: number;
  supportCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
  status?: BehaviorPatternStatus;
}

export interface BehaviorTrigger {
  key: BehaviorTriggerKey;
  description: string;
  patternKeys: BehaviorPatternKey[];
  supportCount: number;
  confidence: number;
  active: boolean;
  evidence: BehaviorEvidence[];
}

export interface BehaviorIntervention {
  id: string;
  type: InterventionType;
  trigger: BehaviorTriggerKey;
  action: string;
  reason: string;
  expectedOutcome: string;
  channel?: "today" | "quest" | "lesson" | "coach";
  confidence: number;
}

export interface BehaviorExperiment {
  id: string;
  target: string;
  start: string;
  end: string;
  baseline: number;
  result: number | null;
  confidence: number;
  status: "active" | "completed" | "abandoned";
}

export interface RecoveryFromLapse {
  reason: string;
  intervention: BehaviorIntervention;
  nextAction: string;
}

export interface BehaviorProfile {
  consistency: number;
  mealAdherence: number;
  trainingAdherence: number;
  sleepBehavior: number;
  weekendPattern: number;
  timeConstraintBehavior: number;
  interventionResponse: Partial<Record<InterventionType, number>>;
  confidence: number;
}

export interface BehaviorLoopResult {
  profile: BehaviorProfile;
  patterns: BehaviorPattern[];
  triggers: BehaviorTrigger[];
  interventions: BehaviorIntervention[];
  experiments: BehaviorExperiment[];
  lapses: RecoveryFromLapse[];
}

/** Context passed to lessons/quests selectors */
export interface BehaviorSelectContext {
  triggers: BehaviorTrigger[];
  patterns: BehaviorPattern[];
  profile: BehaviorProfile;
  weekday: number;
}
