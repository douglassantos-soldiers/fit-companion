/**
 * FASE 18 — run specialists → merge proposals → Safety → Decision Engine bridge.
 * Does not write Living Plan; references snapshot from assembleDecisionContext.
 */

import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";
import type { AgentExecutionPlan } from "@/ai/contracts/agent-execution-plan";
import type { AgentRun } from "@/ai/contracts/agent-run";
import { COACH_AGENT_ID } from "@/ai/agents/ids";
import { runSpecialistAgent } from "@/ai/agents/runtime/run-specialist";
import { mergeSpecialistProposals, type MergeProposalsResult } from "@/ai/decision-pipeline/merge";
import {
  runAuthoritativeBridge,
  type AuthoritativeBridgeResult,
} from "@/ai/e2e/authoritative-bridge";
import { createExecutionPlan } from "@/ai/orchestrator/plan";
import { registerDefaultAgents } from "@/ai/orchestrator/agents/registry";
import type { SkillCallTool } from "@/ai/skills/core/types";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import type { Decision } from "@/lib/engine/decision-contract";

export type RunSpecialistsDecisionPipelineInput = {
  trustedUserId: string;
  intent?: string;
  snapshot: DecisionContextSnapshot;
  plan?: AgentExecutionPlan;
  forceAgents?: string[];
  callTool?: SkillCallTool;
  skipKnowledge?: boolean;
  parentRunId?: string;
  /** When false, skip Living Plan / Outcome learning path pieces (product). Default true for harness. */
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
};

export async function runSpecialistsDecisionPipeline(
  input: RunSpecialistsDecisionPipelineInput,
): Promise<RunSpecialistsDecisionPipelineResult> {
  registerDefaultAgents();

  const planResult =
    input.plan != null
      ? { ok: true as const, plan: input.plan }
      : createExecutionPlan({
          trustedUserId: input.trustedUserId,
          intent: input.intent ?? "",
          ...(input.forceAgents?.length
            ? { overrides: { forceAgents: input.forceAgents } }
            : {}),
        });

  if (!planResult.ok || !planResult.plan) {
    const emptyMerge: MergeProposalsResult = {
      selected: null,
      discarded: [],
      conflicts: [],
      resolution_reason: "plan_failed",
      candidates: [],
    };
    return {
      ok: false,
      plan: planResult.plan,
      specialist_results: [],
      agent_runs: [],
      merge: emptyMerge,
      proposal: null,
      bridge: null,
      decision: null,
      degraded: true,
      reason: "plan_failed",
    };
  }

  const plan = planResult.plan;
  const workerAgents = plan.agents.filter((id) => id !== COACH_AGENT_ID);
  const agentsToRun = workerAgents.length ? workerAgents : plan.agents;

  const specialist_results: AgentAnalysisResult[] = [];
  const agent_runs: AgentRun[] = [];

  for (const agentId of agentsToRun) {
    const out = await runSpecialistAgent({
      trustedUserId: input.trustedUserId,
      agentId,
      plan,
      intent: input.intent ?? plan.intent,
      ...(input.parentRunId ? { parentRunId: input.parentRunId } : {}),
      ...(input.callTool ? { callTool: input.callTool } : {}),
      ...(input.skipKnowledge !== undefined ? { skipKnowledge: input.skipKnowledge } : {}),
      runtimeMode: "deterministic",
    });
    specialist_results.push(out.result);
    agent_runs.push(out.agent_run);
  }

  const merge = mergeSpecialistProposals({
    specialistResults: specialist_results,
    snapshot: input.snapshot,
    safety: input.snapshot.safety,
    userId: input.trustedUserId,
    runId: input.parentRunId ?? plan.plan_id,
  });

  let proposal = merge.selected;
  // Bind context fingerprint when missing
  if (proposal && !proposal.context_id) {
    proposal = {
      ...proposal,
      context_id: input.snapshot.inputFingerprint,
      user_id: input.snapshot.userId,
    };
  }

  if (input.skipBridge) {
    return {
      ok: Boolean(proposal),
      plan,
      specialist_results,
      agent_runs,
      merge,
      proposal,
      bridge: null,
      decision: null,
      degraded: !proposal,
      ...(proposal ? {} : { reason: merge.resolution_reason }),
    };
  }

  if (!proposal) {
    return {
      ok: false,
      plan,
      specialist_results,
      agent_runs,
      merge,
      proposal: null,
      bridge: null,
      decision: null,
      degraded: true,
      reason: merge.resolution_reason || "no_proposal",
    };
  }

  const bridge = runAuthoritativeBridge({
    proposal,
    snapshot: input.snapshot,
    runId: input.parentRunId ?? plan.plan_id,
    emitOutcomeAndLearning: input.emitOutcomeAndLearning ?? true,
  });

  return {
    ok: bridge.ok,
    plan,
    specialist_results,
    agent_runs,
    merge,
    proposal,
    bridge,
    decision: bridge.decision,
    degraded: bridge.degraded || !bridge.ok,
    ...(bridge.reason ? { reason: bridge.reason } : {}),
  };
}
