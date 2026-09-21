export {
  computeLearningInsights,
  topLearningInsight,
  learningWeekHint,
  type LearningAdaptations,
  type LearningInsights,
} from "@/lib/engine/learning/insights";
export { computeLearningSnapshot } from "@/lib/engine/learning/snapshot";
export { extractLearningEvidence } from "@/lib/engine/learning/evidence";
export {
  applyInterventionOutcome,
  confidenceFromCounts,
  emptyInterventionResponse,
  mergeInterventionResponses,
  scalarsFromResponses,
} from "@/lib/engine/learning/responses";
export {
  evaluateExperiment,
  settleExperiments,
  resolveExperiments,
  proteinBreakfastAdherence,
  expressWeekAdherence,
} from "@/lib/engine/learning/experiments";
export {
  learnedToLearningPattern,
  behaviorToLearningPattern,
  mergeCanonicalPatterns,
  deriveUserPreferences,
} from "@/lib/engine/learning/adapters";
export type {
  LearningDomain,
  LearningOutcome,
  LearningEvidence,
  LearningPattern,
  InterventionResponse,
  LearningSignal,
  UserPreference,
  LearningPrior,
  LearningSnapshot,
} from "@/lib/engine/learning/types";
export { LEARNING_SIGNALS } from "@/lib/engine/learning/types";
export {
  extractUserPatterns,
  patternInsights,
  type UserPatterns,
} from "@/lib/engine/user-patterns";
export {
  runBehaviorLoop,
  applyBehaviorOutcome,
  type BehaviorLoopResult,
} from "@/lib/engine/behavior";
