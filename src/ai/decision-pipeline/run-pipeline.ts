/**
 * FASE 18 / 22.1 — CANONICAL_WRAPPER around runProductionAiRuntime.
 * Specialist proposals → merge → Safety → Decision Engine bridge.
 * Does not write Living Plan; references snapshot from assembleDecisionContext.
 */

import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";
import type { AgentExecutionPlan } from "@/ai/contracts/agent-execution-plan";
import type { AgentRun } from "@/ai/contracts/agent-run";
import type { MergeProposalsResult } from "@/ai/decision-pipeline/merge";
import type { AuthoritativeBridgeResult } from "@/ai/runtime/authoritative-bridge";
import { runProductionAiRuntime } from "@/ai/runtime/production-runtime";
import { AI_PATH_LABEL } from "@/ai/runtime/path-labels";
import type { SkillCallTool } from "@/ai/skills/core/types";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import type { Decision } from "@/lib/engine/decision-contract";
import { createExecutionPlan } from "@/ai/orchestrator/plan";
import { registerDefaultAgents } from "@/ai/orchestrator/agents/registry";

export type RunSpecialistsDecisionPipelineInput = {
  trustedUserId: string;
  intent?: string;
  snapshot: DecisionContextSnapshot;
  plan?: AgentExecutionPlan;
  forceAgents?: string[];
  callTool?: SkillCallTool;
  skipKnowledge?: boolean;
  parentRunId?: string;
  /**
   * When false, skip Living Plan / Outcome learning path pieces (product).
   * Default true for harness / FASE 18 tests.
   */
  emitOutcomeAndLearning?: boolean;
  /** Skip bridge (merge only) */
  skipBridge?: boolean;
};

export type RunSpecialistsDecisionPipelineResult = {
  ok: boolean;
  plan: AgentExecutionPlan;
  specialist_results: AgentAnalysisResult[];
  agent_runs: AgentRun[];
  merge: MergeProposalsResult;
  proposal: DecisionProposal | null;
  bridge: AuthoritativeBridgeResult | null;
  decision: Decision | null;
  degraded: boolean;
  reason?: string;
  /** FASE 22.1 */
  path_label?: typeof AI_PATH_LABEL.CANONICAL_WRAPPER;
};

function emptyMerge(reason: string): MergeProposalsResult {
  return {
    selected: null,
    discarded: [],
    conflicts: [],
    resolution_reason: reason,
    candidates: [],
  };
}

/**
 * Thin wrapper over the canonical production runtime (compat API for FASE 18).
 *
 * @classification CANONICAL_WRAPPER
 */
export async function runSpecialistsDecisionPipeline(
  input: RunSpecialistsDecisionPipelineInput,
): Promise<RunSpecialistsDecisionPipelineResult> {
  registerDefaultAgents();

  let plan = input.plan;
  if (!plan) {
    const planResult = createExecutionPlan({
      trustedUserId: input.trustedUserId,
      intent: input.intent ?? "",
      ...(input.forceAgents?.length
        ? { overrides: { forceAgents: input.forceAgents } }
        : {}),
    });
    if (!planResult.ok || !planResult.plan) {
      return {
        ok: false,
        plan: planResult.plan,
        specialist_results: [],
        agent_runs: [],
        merge: emptyMerge("plan_failed"),
        proposal: null,
        bridge: null,
        decision: null,
        degraded: true,
        reason: "plan_failed",
        path_label: AI_PATH_LABEL.CANONICAL_WRAPPER,
      };
    }
    plan = planResult.plan;
  }

  const out = await runProductionAiRuntime({
    trustedUserId: input.trustedUserId,
    intent: input.intent,
    snapshot: input.snapshot,
    plan,
    ...(input.forceAgents ? { forceAgents: input.forceAgents } : {}),
    ...(input.callTool ? { callTool: input.callTool } : {}),
    ...(input.skipKnowledge !== undefined ? { skipKnowledge: input.skipKnowledge } : {}),
    ...(input.parentRunId ? { parentRunId: input.parentRunId } : {}),
    emitOutcomeAndLearning: input.emitOutcomeAndLearning ?? true,
    skipBridge: input.skipBridge ?? false,
    runtimeMode: "deterministic",
  });

  return {
    ok: out.ok,
    plan: out.plan ?? plan,
    specialist_results: out.specialist_results,
    agent_runs: out.agent_runs,
    merge: out.merge,
    proposal: out.proposal,
    bridge: out.bridge,
    decision: out.decision,
    degraded: out.degraded,
    ...(out.reason ? { reason: out.reason } : {}),
    path_label: AI_PATH_LABEL.CANONICAL_WRAPPER,
  };
}
