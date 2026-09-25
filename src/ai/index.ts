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
  recordAudit,
  listAudits,
  clearAuditLog,
  computeAiMetrics,
  diagnoseAgentRun,
  runAiEvaluation,
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
  AgentRunDiagnosticView,
} from "./governance";
