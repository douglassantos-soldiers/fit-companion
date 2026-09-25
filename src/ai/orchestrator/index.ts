/**
 * Agent Orchestrator — Performance OS.
 * Creates AgentExecutionPlan only. Not Decision authority. No Agent Runtime.
 */

export type {
  AgentExecutionPlan,
  AgentExecutionPlanStatus,
  PlanSequenceStep,
  PlanSequenceStepKind,
} from "@/ai/contracts/agent-execution-plan";

export { ORCH_ERROR, OrchError } from "@/ai/orchestrator/core/errors";
export {
  DEFAULT_MAX_COST,
  DEFAULT_MAX_STEPS,
  DEFAULT_TIMEOUT_MS,
  COST,
} from "@/ai/orchestrator/core/types";
export type {
  CreateExecutionPlanInput,
  CreateExecutionPlanResult,
} from "@/ai/orchestrator/core/types";
export { planFingerprint, newPlanId } from "@/ai/orchestrator/core/fingerprint";
export { classifyIntent } from "@/ai/orchestrator/intent/classify";
export type { IntentClass } from "@/ai/orchestrator/intent/classify";
export {
  clearAgentRegistry,
  getAgent,
  hasAgent,
  listAgents,
  registerAgent,
  registerDefaultAgents,
} from "@/ai/orchestrator/agents/registry";
export { createExecutionPlan } from "@/ai/orchestrator/plan";

import { registerDefaultAgents } from "@/ai/orchestrator/agents/registry";

registerDefaultAgents();
