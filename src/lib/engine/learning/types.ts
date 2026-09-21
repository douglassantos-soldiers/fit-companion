/**
 * Learning Intelligence — canonical types.
 * Not a psychological diagnosis. No invented personality traits.
 */
import type {
  BehaviorExperiment,
  BehaviorLoopResult,
  InterventionType,
} from "@/lib/engine/behavior/types";
import type { LearnedPattern } from "@/lib/engine/learned-patterns";
import type { LearningInsights } from "@/lib/engine/learning/insights";

export type LearningDomain =
  "training" | "nutrition" | "recovery" | "behavior" | "coach" | "challenge";

export type LearningOutcome = "success" | "fail" | "neutral";

export type LearningEvidenceSource = "session" | "meal" | "checkin" | "outcome" | "experiment";

export type LearningEvidence = {
  date: string;
  source: LearningEvidenceSource;
  note: string;
};

export type LearningPattern = {
  domain: LearningDomain;
  key: string;
  status: "candidate" | "active" | "decayed" | "blocked";
  supportCount: number;
  confidence: number;
  evidence: LearningEvidence[];
  successfulOutcomes: number;
  failedOutcomes: number;
  lastObservedAt: string;
};

export type InterventionResponse = {
  type: InterventionType;
  successCount: number;
  failureCount: number;
  neutralCount: number;
  confidence: number;
  lastUsedAt: string | null;
};

export const LEARNING_SIGNALS = [
  "express_training_high_adherence",
  "volume_reduction_helps",
  "meal_priority_logged",
  "nutrition_target_adherence",
  "sleep_priority_followed",
  "rest_next_day_recovery",
] as const;

export type LearningSignal = (typeof LEARNING_SIGNALS)[number];

export type UserPreference = {
  key: string;
  label: string;
  sourcePattern: string;
  strength: number;
};

export type LearningPrior = {
  patterns?: LearnedPattern[] | null;
  interventionResponses?: InterventionResponse[];
  experiments?: BehaviorExperiment[];
};

export type LearningSnapshot = {
  date: string;
  insights: LearningInsights | null;
  evidence: LearningEvidence[];
  learnedPatterns: LearnedPattern[];
  patterns: LearningPattern[];
  behavior: BehaviorLoopResult;
  interventionResponses: InterventionResponse[];
  experiments: BehaviorExperiment[];
  preferences: UserPreference[];
  learningConfidence: number;
};
