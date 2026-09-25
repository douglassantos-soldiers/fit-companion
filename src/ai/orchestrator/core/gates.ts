/**
 * Plan gates — authz, loop, steps, timeout, cost.
 */

import type { AgentExecutionPlan } from "@/ai/contracts/agent-execution-plan";
import type { PlanSequenceStep } from "@/ai/contracts/agent-execution-plan";
import { hasAgent } from "@/ai/orchestrator/agents/registry";
import { ORCH_ERROR, OrchError } from "@/ai/orchestrator/core/errors";
import { COST } from "@/ai/orchestrator/core/types";
import { planFingerprint } from "@/ai/orchestrator/core/fingerprint";

export function assertAgentsRegistered(agentIds: string[]): void {
  for (const id of agentIds) {
    if (!hasAgent(id)) {
      throw new OrchError(ORCH_ERROR.INVALID_AGENT, `unknown_agent:${id}`);
    }
  }
}

export function assertNoLoop(fingerprint: string, parent?: string): void {
  if (parent && parent === fingerprint) {
    throw new OrchError(ORCH_ERROR.LOOP_DETECTED, "plan_loop_detected");
  }
}

export function assertTimeoutBudget(timeout: number): void {
  if (timeout <= 0) {
    throw new OrchError(ORCH_ERROR.TIMEOUT_BUDGET, "timeout_budget_invalid");
  }
}

export function estimateCost(sequence: PlanSequenceStep[]): number {
  let total = 0;
  for (const step of sequence) {
    if (step.kind === "agent") total += COST.agent;
    else if (step.kind === "skill") total += COST.skill;
    else if (step.kind === "tool") total += COST.tool;
    else if (step.kind === "knowledge") total += COST.knowledge;
    else total += COST.handoff;
  }
  return total;
}

export function assertCostLimit(cost: number, maxCost: number): void {
  if (cost > maxCost) {
    throw new OrchError(ORCH_ERROR.COST_LIMIT, `cost:${cost}>${maxCost}`);
  }
}

export function assertMaxSteps(sequenceLength: number, maxSteps: number): void {
  if (sequenceLength > maxSteps) {
    throw new OrchError(ORCH_ERROR.MAX_STEPS, `steps:${sequenceLength}>${maxSteps}`);
  }
}

export function buildFingerprint(
  plan: Pick<AgentExecutionPlan, "intent" | "agents" | "skills" | "tools">,
): string {
  return planFingerprint({
    intent: plan.intent,
    agents: plan.agents,
    skills: plan.skills,
    tools: plan.tools,
  });
}
