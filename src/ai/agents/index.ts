/**
 * Agents module — Coach + Specialist Agents (thin runtime).
 * Agents never access DB directly; never emit final Decision.
 */

export type { Agent, AgentCapability, AgentKind } from "@/ai/contracts/agent";
export type { AgentRun, AgentRunStatus } from "@/ai/contracts/agent-run";
export type { AgentAnalysisResult, AgentAnalysisStatus } from "@/ai/contracts/agent-analysis";

export {
  COACH_AGENT_ID,
  SPECIALIST_AGENT_IDS,
  SPECIALIST_BEHAVIOR_ID,
  SPECIALIST_NUTRITION_ID,
  SPECIALIST_PERFORMANCE_ID,
  SPECIALIST_RECOVERY_ID,
  SPECIALIST_TRAINING_ID,
} from "@/ai/agents/ids";
export type { SpecialistAgentId } from "@/ai/agents/ids";

export { AGENT_ERROR, AgentError } from "@/ai/agents/runtime/errors";
export { runSpecialistAgent } from "@/ai/agents/runtime/run-specialist";
export type {
  RunSpecialistAgentInput,
  RunSpecialistAgentResult,
} from "@/ai/agents/runtime/run-specialist";
export { clearAgentRunLog, listAgentRuns } from "@/ai/agents/runtime/agent-run-log";

export {
  clearAgentRegistry,
  getAgent,
  hasAgent,
  listAgents,
  registerAgent,
  registerDefaultAgents,
} from "@/ai/orchestrator/agents/registry";

export {
  runCoachAgent,
  detectCoachAgentIntent,
  COACH_AGENT_ERROR,
} from "@/ai/agents/coach";
export type {
  RunCoachAgentInput,
  RunCoachAgentResult,
  CoachAgentIntentKind,
  CoachFactPack,
} from "@/ai/agents/coach";
