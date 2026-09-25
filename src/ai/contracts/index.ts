/**
 * AI contracts barrel — Performance OS foundation.
 * No runtime business logic here; types and re-exports only.
 */

export type {
  DerivedPerformanceData,
  ObservedPerformanceData,
  PerformanceContext,
  PerformanceContextConstraints,
  PerformanceContextIdentity,
  ContextSignal,
  DataFreshness,
  SignalSource,
  PerformanceContextSignals,
  PerformanceContextWearable,
  RecentOutcomeEntry,
} from "./performance-context";
export {
  toPerformanceContext,
  makeSignal,
  signalValue,
  getPerformanceContextFromSnapshot,
  getTrainingContext,
  getNutritionContext,
  getRecoveryContext,
  getBehaviorContext,
} from "./performance-context";
export type {
  BehaviorContextView,
  NutritionContextView,
  RecoveryContextView,
  TrainingContextView,
} from "./performance-context";

export type { Decision, DecisionAction, DecisionStatus, DecisionView } from "./decision";
export {
  DECISION_CONTRACT_VERSION,
  buildDecisionId,
  canonicalDecisionType,
  decisionsFromBundle,
  engineDecisionToContract,
  evidenceForDecision,
  expectedOutcomeForDecision,
  selectWhyPanel,
  toDecisionView,
} from "./decision";

export type { DecisionEvidence, DecisionEvidenceItem } from "./decision-evidence";
export {
  emptyEvidence,
  evidenceFromMetrics,
  evidenceFromSnapshotLike,
  evidenceItemsFromContext,
  mergeEvidence,
} from "./decision-evidence";

export type { DecisionProposal, DecisionProposalSource, ResolveProposalResult } from "./proposal";
export {
  buildProposalId,
  parseDecisionProposal,
  resolveProposalAgainstEngine,
  toDecisionProposal,
  validateProposalAgainstSafety,
  validateProposalContext,
} from "./proposal";

export type { Agent, AgentCapability, AgentKind } from "./agent";
export type { AgentRun, AgentRunStatus } from "./agent-run";
export type { AgentAnalysisResult, AgentAnalysisStatus } from "./agent-analysis";
export type {
  AgentExecutionPlan,
  AgentExecutionPlanStatus,
  PlanSequenceStep,
  PlanSequenceStepKind,
} from "./agent-execution-plan";
export type { Skill, SkillDomain, SkillKind, SkillSafetyRequirements } from "./skill";
export type { SkillRun, SkillRunStatus } from "./skill-run";
export type { SkillEvidenceItem, SkillProposal, SkillResult } from "./skill-result";
export type { Tool, ToolAccess, ToolAuthorization, ToolClassification } from "./tool";
export type { ToolCall, ToolCallStatus } from "./tool-call";

export type { Outcome, OutcomeQuality, OutcomeWindow } from "./outcome";
export type {
  LearningEvent,
  LearningEventKind,
  LearningEventDomain,
  EngineLearningEvent,
} from "./learning-event";
export { LEARNING_ENGINE_VERSION, LEARNING_CONTRACT_VERSION } from "./learning-event";
export type {
  LearningOutcome,
  LearningOutcomeResult,
  LearningOutcomeQuality,
  LearningSignalRecord,
  LearningDecisionRef,
  LearningCycleStatus,
} from "@/lib/engine/learning";
export {
  runLearningCycle,
  toLearningDecisionRef,
  fromAiOutcome,
  toAiOutcome,
} from "@/lib/engine/learning";
export type {
  KnowledgeDocument,
  KnowledgeDocumentSource,
  KnowledgeDomain,
  KnowledgeSourceType,
} from "./knowledge-document";
export { KNOWLEDGE_DOMAINS } from "./knowledge-document";
export type { KnowledgeChunk } from "./knowledge-chunk";
export type { KnowledgeSource, KnowledgeTrustTier } from "./knowledge-source";
export type {
  KnowledgeRetrieval,
  KnowledgeRetrievalHit,
  KnowledgeRetrievalMode,
} from "./knowledge-retrieval";
export type { KnowledgeCitation } from "./knowledge-citation";
export type {
  MemoryData,
  MemoryFamily,
  MemoryRecord,
  MemorySource,
  MemoryStatus,
} from "./memory-record";
export type {
  DecisionMemory,
  DecisionMemoryType,
  LearningMemory,
  LearningMemoryType,
  OutcomeMemory,
  OutcomeMemoryType,
  UserMemoryRecord,
  UserMemoryType,
} from "./memory-families";
export { userMemoryToRecord } from "./memory-families";
export type { UserMemory, UserMemoryKind } from "./user-memory";
export type { TrustedUserId } from "./trusted-user-id";
export { asTrustedUserId } from "./trusted-user-id";
