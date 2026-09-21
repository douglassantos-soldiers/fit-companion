/**
 * Adaptive Coach Platform types (Phase 3).
 * LLM explains; engines calculate. No AppState dump to the model.
 */

export type CoachMemoryKind =
  "facts" | "preferences" | "patterns" | "recent_decisions" | "coach_notes";

export type CoachTurnKind = "factual" | "contextual" | "explanatory" | "actionable" | "medical";

export type CoachActionId =
  | "adapt_workout"
  | "recommend_rest"
  | "recommend_meal"
  | "recommend_sleep"
  | "recommend_hydration"
  | "start_checkin"
  | "open_training"
  | "open_nutrition";

export type CoachProposalType =
  | "REDUCE_VOLUME"
  | "INCREASE_RECOVERY"
  | "REST"
  | "EXPRESS_WORKOUT"
  | "FULL_WORKOUT"
  | "DELOAD"
  | "NUTRITION_FOCUS"
  | "HYDRATION_FOCUS"
  | "SLEEP_FOCUS"
  | "CHECKIN";

export interface CoachProposal {
  type: CoachProposalType;
  action: CoachActionId;
  value: string | number | boolean;
  reasonCodes: string[];
  evidence: Record<string, string | number | boolean | null>;
  confidence: number;
}

export interface CoachAction {
  id: CoachActionId;
  label: string;
  href: string;
}

export interface CoachEvidencePack {
  sleepHours?: number | null;
  hardRpeStreak?: number | null;
  recoveryLevel?: string | null;
  trainingMode?: string | null;
  volumeFactor?: number | null;
  proteinG?: number | null;
  proteinTarget?: number | null;
  decisionSummary?: string | null;
  reasonCodes?: string[];
}

export interface CoachMemoryEntry {
  kind: CoachMemoryKind;
  key: string;
  value: string | number | boolean | Record<string, unknown>;
  confidence: number;
  updatedAt: string;
}

export interface CoachContextProfile {
  name: string;
  goal: string;
  level: string;
  weightKg: number;
  daysPerWeek: number;
  equipment: string;
  restrictions: string[];
  primaryBlocker?: string;
}

export interface CoachContext {
  userId: string;
  date: string;
  profile: CoachContextProfile | null;
  goals: { proteinG: number; kcal: number; waterMl: number } | null;
  training: {
    streak: number;
    sessions7d: number;
    sessions28d: number;
    todayMode: string | null;
    todayTitle: string | null;
    volumeFactor: number | null;
    lastSessionDate: string | null;
    lastSessionRpe: string | null;
  };
  exercisePerformance: {
    recentPrs: Array<{ label: string; value: number; date: string }>;
    top1rm: Array<{ exerciseId: string; estimated1rm: number }>;
  };
  recovery: {
    level: string | null;
    score: number | null;
    sleepHours: number | null;
    energy: string | null;
    hardRpeStreak: number;
    readiness?: string | null;
    sleepConfidence?: number;
    checkInConfidence?: number;
    wearableConfidence?: number;
  };
  nutrition: {
    proteinG: number;
    carbG: number;
    fatG: number;
    kcal: number;
    mealsLogged: number;
    proteinTarget: number | null;
    loggingConfidence: number | null;
  };
  supplements: {
    routineIds: string[];
    adherence30d: number | null;
  };
  behavior: {
    workouts7d: number;
    meals7d: number;
    coachMessages: number;
  };
  customer360: {
    nutritionAdherence: number | null;
    recoveryScore: number | null;
    performanceScore: number | null;
  };
  todayDecisions: Array<{
    type: string;
    value: string;
    reasonCodes: string[];
    confidence: number;
    explanation: string;
    source?: "decision_log" | "recomputed_live" | "server_snapshot";
    attribution?: {
      expectedAction?: string;
      actionStatus?: string;
      attributionType?: string;
      learningSignal?: string | null;
    };
  }>;
  recentDecisions: Array<{
    date: string;
    type: string;
    value: string;
    reasonCodes: string[];
    outcome?: string | null;
  }>;
  recentOutcomes?: Array<{
    outcomeType: string;
    value: unknown;
    observedAt: string;
  }>;
  userPatterns: string[];
  safety: {
    escalateCare: boolean;
    blockStims: boolean;
    preferLightTraining: boolean;
    flags: string[];
    reasons: string[];
  };
  memory: CoachMemoryEntry[];
  livingSummary: string;
  why: string[];
  reasonCodes: string[];
}

export type CoachToolName =
  | "get_profile"
  | "get_training_history"
  | "get_exercise_history"
  | "get_prs"
  | "get_1rm"
  | "get_muscle_recovery"
  | "get_nutrition_context"
  | "get_recovery_context"
  | "get_behavior_patterns"
  | "get_active_triggers"
  | "get_recent_interventions"
  | "get_experiment_status"
  | "get_recent_decisions"
  | "get_today_plan"
  | "get_exercise_guide"
  | "get_howto";

export interface WorkflowResult {
  workflow: string;
  analysis: string[];
  proposal: CoachProposal | null;
  outcomeExpectation: string;
  evidence: CoachEvidencePack;
  actions: CoachAction[];
  wins?: string[];
  risks?: string[];
  nextFocus?: string;
  confidence?: number;
}
