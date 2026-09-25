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
  LearningResultKind,
  LearningEvidence,
  LearningPattern,
  InterventionResponse,
  LearningSignal,
  UserPreference,
  LearningPrior,
  LearningSnapshot,
} from "@/lib/engine/learning/types";
export { LEARNING_SIGNALS } from "@/lib/engine/learning/types";
export { LEARNING_ENGINE_VERSION, LEARNING_CONTRACT_VERSION } from "@/lib/engine/learning/version";
export {
  toLearningDecisionRef,
  type LearningDecisionRef,
} from "@/lib/engine/learning/decision-ref";
export {
  fromAiOutcome,
  toAiOutcome,
  normalizeAdherence,
  isPartialAdherence,
  type LearningOutcome,
  type LearningOutcomeResult,
  type LearningOutcomeQuality,
  type AiOutcomeLike,
} from "@/lib/engine/learning/outcome";
export {
  buildLearningEvent,
  buildLearningEventId,
  type LearningEvent,
  type LearningEventKind,
  type LearningEventDomain,
  type EngineLearningEvent,
} from "@/lib/engine/learning/events";
export {
  buildLearningSignalRecord,
  buildSignalNarrative,
  resolveSignalKey,
  isLearningSignal,
  type LearningSignalRecord,
} from "@/lib/engine/learning/signals";
export {
  runLearningCycle,
  type RunLearningCycleInput,
  type RunLearningCycleResult,
  type LearningCycleStatus,
  type LearningRecoveryContext,
} from "@/lib/engine/learning/run-learning";
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
