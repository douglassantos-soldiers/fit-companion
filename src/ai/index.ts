/**
 * Performance OS — AI-native foundation surface.
 *
 * Contracts and module boundaries only. Deterministic engines remain in
 * src/lib/engine/. Adaptive Coach remains in src/lib/coach/ until migrated.
 *
 * See docs/AI_ARCHITECTURE.md.
 */

export * from "./contracts";
export { COACH_AGENT_ID, SPECIALIST_AGENT_IDS } from "./agents";
export type { SpecialistAgentId } from "./agents";
export { runSpecialistAgent } from "./agents";
export {
  AI_GOVERNANCE_VERSION,
  AI_EVAL_VERSION,
  GOLDEN_DATASET_VERSION,
  recordAudit,
  listAudits,
  clearAuditLog,
  computeAiMetrics,
  diagnoseAgentRun,
  runAiEvaluation,
  runAiEvaluationV2,
  compareEvalArtifacts,
  auditFromIdentity,
} from "./governance";
export type {
  GovernanceAuditKind,
  GovernanceAuditRecord,
  AiAuditEvent,
  AiMetrics,
  EvalCase,
  EvalCaseStatus,
  EvalResult,
  EvalSuiteResult,
  EvaluationReport,
  AgentRunDiagnosticView,
} from "./governance";

/** FASE 22.1 — CANONICAL production AI runtime */
export {
  runProductionAiRuntime,
  runAuthoritativeBridge,
  AI_PATH_LABEL,
  initializeAIInfrastructure,
  ensureAIInfrastructureReady,
  getAIInfrastructureReport,
} from "./runtime";
export type {
  RunProductionAiRuntimeResult,
  RunProductionAiRuntimeInput,
  AuthoritativeBridgeInput,
  AuthoritativeBridgeResult,
  ProductionAiCorrelation,
  AiInfrastructureReport,
  AiInfrastructureStatus,
} from "./runtime";

/** FASE 15 — E2E harness: import from `@/ai/e2e` only (TEST_ONLY; not public product surface). */

/** FASE 18 — specialist proposal merge → Decision Engine (CANONICAL_WRAPPER) */
export {
  runSpecialistsDecisionPipeline,
  mergeSpecialistProposals,
  attachProposalEvidence,
} from "./decision-pipeline";
export type {
  RunSpecialistsDecisionPipelineResult,
  MergeProposalsResult,
  ProposalConflict,
} from "./decision-pipeline";
