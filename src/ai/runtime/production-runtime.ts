// @ts-nocheck
/**
 * FASE 22.1 — CANONICAL production AI runtime.
 *
 * Single production entrypoint for:
 * Identity → Context → Orchestrator → Specialists → Skills/Tools/RAG/Memory
 * → DecisionProposal → Conflict Resolution → Safety → Existing Decision Engine
 * → Decision (engine) → Living Plan (snapshot ref) → optional Outcome/Learning → Audit
 *
 * Does NOT replace Decision Engine. Does NOT write Living Plan.
 * Agents emit DecisionProposal only.
 */

import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";
import type { AgentExecutionPlan } from "@/ai/contracts/agent-execution-plan";
import type { AgentRun } from "@/ai/contracts/agent-run";
import { asTrustedUserId } from "@/ai/contracts/trusted-user-id";
import { COACH_AGENT_ID } from "@/ai/agents/ids";
import { runSpecialistAgent } from "@/ai/agents/runtime/run-specialist";
import { mergeSpecialistProposals, type MergeProposalsResult } from "@/ai/decision-pipeline/merge";
import {
  runAuthoritativeBridge,
  type AuthoritativeBridgeResult,
} from "@/ai/runtime/authoritative-bridge";
import { createExecutionPlan } from "@/ai/orchestrator/plan";
import { registerDefaultAgents } from "@/ai/orchestrator/agents/registry";
import type { SkillCallTool } from "@/ai/skills/core/types";
import type { DomainContextLoader } from "@/ai/mcp/core/types";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import type { Decision } from "@/lib/engine/decision-contract";
import type { LivingPlanSnapshot } from "@/lib/types";
import type { Outcome } from "@/ai/contracts/outcome";
import type { RunLearningCycleResult } from "@/lib/engine/learning/run-learning";
import {
  recordAudit,
} from "@/ai/governance/audit";
import {
  stageFail,
  stageOk,
  type AiPipelineErrorCode,
  type PipelineStageResult,
} from "@/ai/e2e/errors";
import { AI_PATH_LABEL, AI_PATH_LABEL_META_KEY } from "@/ai/runtime/path-labels";

export type ProductionAiRuntimeErrorCode =
  | AiPipelineErrorCode
  | "invalid_identity"
  | "missing_context"
  | "plan_failed"
  | "specialist_failure"
  | "skill_failure"
  | "no_proposal"
  | "bridge_failed";

export type RunProductionAiRuntimeInput = {
  trustedUserId: string | null;
  intent?: string;
  /** Required for Decision path — must already be assembled by Decision Engine. */
  snapshot: DecisionContextSnapshot | null;
  plan?: AgentExecutionPlan;
  forceAgents?: string[];
  callTool?: SkillCallTool;
  /** MCP domain context (QA / E2E fixtures); tools stay real handlers. */
  loader?: DomainContextLoader;
  skipKnowledge?: boolean;
  parentRunId?: string;
  /**
   * Product default false: Decision + Living Plan ref only.
   * E2E / harness may set true for synthetic Outcome/Learning.
   */
  emitOutcomeAndLearning?: boolean;
  /** Skip bridge (merge only). */
  skipBridge?: boolean;
  /** When set, stabilizes run_id for idempotent retries (does not rewrite Decision DB). */
  idempotencyKey?: string;
  runtimeMode?: "deterministic" | "llm" | "hybrid";
  /** Test / diagnostics injects — never invent Decision on failure. */
  inject?: ProductionAiRuntimeInject;
};

export type ProductionAiRuntimeInject = {
  specialistFailure?: boolean;
  skillFailure?: boolean;
  toolFailure?: boolean;
  ragFailure?: boolean;
  memoryFailure?: boolean;
  invalidProposal?: boolean;
  safetyRejection?: boolean;
};

export type ProductionAiCorrelation = {
  run_id: string;
  parent_run_id: string | null;
  skill_ids: string[];
  skill_run_ids: string[];
  tool_ids: string[];
  tool_call_ids: string[];
  retrieval_ids: string[];
  proposal_id: string | null;
  decision_id: string | null;
  outcome_id: string | null;
  learning_event_id: string | null;
  context_fingerprint: string | null;
};

export type RunProductionAiRuntimeResult = {
  ok: boolean;
  degraded: boolean;
  path_label: typeof AI_PATH_LABEL.CANONICAL;
  error_code?: ProductionAiRuntimeErrorCode;
  reason?: string;
  plan: AgentExecutionPlan | null;
  specialist_results: AgentAnalysisResult[];
  agent_runs: AgentRun[];
  merge: MergeProposalsResult;
  proposal: DecisionProposal | null;
  bridge: AuthoritativeBridgeResult | null;
  decision: Decision | null;
  living_plan: LivingPlanSnapshot | null;
  outcome: Outcome | null;
  learning: RunLearningCycleResult | null;
  stage_results: PipelineStageResult[];
  correlation: ProductionAiCorrelation;
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

function hashIdempotencyKey(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function newRunId(idempotencyKey?: string): string {
  if (idempotencyKey?.trim()) {
    return `prod_${hashIdempotencyKey(idempotencyKey.trim())}`;
  }
  return `prod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function collectCorrelation(
  runId: string,
  parentRunId: string | null,
  specialistResults: AgentAnalysisResult[],
  proposal: DecisionProposal | null,
  bridge: AuthoritativeBridgeResult | null,
  contextFingerprint: string | null,
): ProductionAiCorrelation {
  const skill_run_ids: string[] = [];
  const skill_ids: string[] = [];
  const tool_call_ids: string[] = [];
  const tool_ids: string[] = [];
  const retrieval_ids: string[] = [];

  for (const r of specialistResults) {
    for (const id of r.skill_run_ids ?? []) skill_run_ids.push(id);
    for (const id of r.tool_call_ids ?? []) tool_call_ids.push(id);
    for (const c of r.citations ?? []) {
      const meta = c as { retrieval_id?: string };
      if (meta.retrieval_id) retrieval_ids.push(meta.retrieval_id);
    }
    const analysis = r.analysis as {
      skills?: Array<{ skillId?: string }>;
      tools?: Array<{ toolId?: string }>;
      retrieval_ids?: string[];
    } | null;
    for (const s of analysis?.skills ?? []) {
      if (s.skillId) skill_ids.push(s.skillId);
    }
    for (const t of analysis?.tools ?? []) {
      if (t.toolId) tool_ids.push(t.toolId);
    }
    for (const id of analysis?.retrieval_ids ?? []) retrieval_ids.push(id);
  }

  const learningEvent =
    bridge?.learning?.events?.[0]?.event_id ??
    null;

  return {
    run_id: runId,
    parent_run_id: parentRunId,
    skill_ids: [...new Set(skill_ids)],
    skill_run_ids: [...new Set(skill_run_ids)],
    tool_ids: [...new Set(tool_ids)],
    tool_call_ids: [...new Set(tool_call_ids)],
    retrieval_ids: [...new Set(retrieval_ids)],
    proposal_id: proposal?.proposal_id ?? null,
    decision_id: bridge?.decision?.decision_id ?? null,
    outcome_id: bridge?.outcome?.outcome_id ?? null,
    learning_event_id: learningEvent,
    context_fingerprint: contextFingerprint,
  };
}

function failResult(opts: {
  runId: string;
  parentRunId: string | null;
  stages: PipelineStageResult[];
  error_code: ProductionAiRuntimeErrorCode;
  reason: string;
  plan?: AgentExecutionPlan | null;
  merge?: MergeProposalsResult;
  specialist_results?: AgentAnalysisResult[];
  agent_runs?: AgentRun[];
  snapshotFp?: string | null;
}): RunProductionAiRuntimeResult {
  const merge = opts.merge ?? emptyMerge(opts.reason);
  const specialist_results = opts.specialist_results ?? [];
  const agent_runs = opts.agent_runs ?? [];
  return {
    ok: false,
    degraded: true,
    path_label: AI_PATH_LABEL.CANONICAL,
    error_code: opts.error_code,
    reason: opts.reason,
    plan: opts.plan ?? null,
    specialist_results,
    agent_runs,
    merge,
    proposal: null,
    bridge: null,
    decision: null,
    living_plan: null,
    outcome: null,
    learning: null,
    stage_results: opts.stages,
    correlation: collectCorrelation(
      opts.runId,
      opts.parentRunId,
      specialist_results,
      null,
      null,
      opts.snapshotFp ?? null,
    ),
  };
}

/**
 * Canonical production AI runtime.
 *
 * @classification CANONICAL
 */
export async function runProductionAiRuntime(
  input: RunProductionAiRuntimeInput,
): Promise<RunProductionAiRuntimeResult> {
  registerDefaultAgents();

  const stages: PipelineStageResult[] = [];
  const parentRunId = input.parentRunId ?? null;
  const runId = newRunId(input.idempotencyKey);
  const inject = input.inject ?? {};

  // --- 1. Identity ---
  const rawUser = input.trustedUserId?.trim() ?? "";
  if (!rawUser) {
    stages.push(stageFail("identity", "authentication_error", "invalid_identity", runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "invalid_identity",
      reason: "invalid_identity",
    });
  }

  let userId: string;
  try {
    userId = asTrustedUserId(rawUser);
  } catch {
    stages.push(stageFail("identity", "authentication_error", "invalid_identity", runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "invalid_identity",
      reason: "invalid_identity",
    });
  }
  stages.push(stageOk("identity", { user_id: userId.slice(0, 8) }, runId));

  // --- 2. Context ---
  const snapshot = input.snapshot;
  if (!snapshot?.inputFingerprint) {
    stages.push(stageFail("context", "context_error", "missing_context", runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "missing_context",
      reason: "missing_context",
    });
  }
  stages.push(
    stageOk("context", { fingerprint: snapshot.inputFingerprint }, runId),
  );

  // --- 3. Orchestrator ---
  const planResult =
    input.plan != null
      ? { ok: true as const, plan: input.plan }
      : createExecutionPlan({
          trustedUserId: userId,
          intent: input.intent ?? "",
          contextAvailable: true,
          ...(input.forceAgents?.length
            ? { overrides: { forceAgents: input.forceAgents } }
            : {}),
        });

  if (!planResult.ok || !planResult.plan || planResult.plan.status === "rejected") {
    const reason =
      planResult.plan && "rejection_reason" in planResult.plan
        ? String(planResult.plan.rejection_reason ?? "plan_failed")
        : "plan_failed";
    stages.push(stageFail("orchestrator", "context_error", reason, runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "plan_failed",
      reason,
      plan: planResult.plan ?? null,
      snapshotFp: snapshot.inputFingerprint,
    });
  }

  const plan = planResult.plan;
  stages.push(
    stageOk("orchestrator", { plan_id: plan.plan_id, agents: plan.agents.join(",") }, runId),
  );

  // --- Kill switch soft-guard (FASE 22.11) — skip specialists/LLM; Decision Engine not gated ---
  {
    const { isAiEnabled, isSpecialistsEnabled } = await import("@/ai/runtime/feature-flags");
    if (!isAiEnabled() || !isSpecialistsEnabled()) {
      const reason = !isAiEnabled() ? "ai_global_disabled" : "specialists_disabled";
      stages.push(
        stageOk("agent", { skipped: reason, agent_count: "0" }, runId),
      );
      const merge = emptyMerge(reason);
      stages.push(stageOk("merge", { proposals: "0", reason }, runId));
      return {
        ok: true,
        degraded: true,
        path_label: AI_PATH_LABEL.CANONICAL,
        reason,
        plan,
        specialist_results: [],
        agent_runs: [],
        merge,
        proposal: null,
        bridge: null,
        decision: null,
        living_plan: null,
        outcome: null,
        learning: null,
        stage_results: stages,
        correlation: collectCorrelation(
          runId,
          parentRunId,
          [],
          null,
          null,
          snapshot.inputFingerprint,
        ),
      };
    }
  }

  // --- Injected layer failures (before / instead of full specialist loop) ---
  if (inject.toolFailure) {
    stages.push(stageFail("tool", "tool_error", "tool_failure", runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "tool_error",
      reason: "tool_failure",
      plan,
      snapshotFp: snapshot.inputFingerprint,
    });
  }
  if (inject.ragFailure) {
    stages.push(stageFail("rag", "rag_error", "rag_failure", runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "rag_error",
      reason: "rag_failure",
      plan,
      snapshotFp: snapshot.inputFingerprint,
    });
  }
  if (inject.memoryFailure) {
    stages.push(stageFail("memory", "memory_error", "memory_failure", runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "memory_error",
      reason: "memory_failure",
      plan,
      snapshotFp: snapshot.inputFingerprint,
    });
  }
  if (inject.specialistFailure) {
    stages.push(stageFail("agent", "context_error", "specialist_failure", runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "specialist_failure",
      reason: "specialist_failure",
      plan,
      snapshotFp: snapshot.inputFingerprint,
    });
  }
  if (inject.skillFailure) {
    stages.push(stageFail("skill", "skill_error", "skill_failure", runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "skill_failure",
      reason: "skill_failure",
      plan,
      snapshotFp: snapshot.inputFingerprint,
    });
  }

  // --- 4. Specialists ---
  const workerAgents = plan.agents.filter((id) => id !== COACH_AGENT_ID);
  const agentsToRun = workerAgents.length ? workerAgents : plan.agents;
  const specialist_results: AgentAnalysisResult[] = [];
  const agent_runs: AgentRun[] = [];
  const effectiveParent = parentRunId ?? runId;

  for (const agentId of agentsToRun) {
    const out = await runSpecialistAgent({
      trustedUserId: userId,
      agentId,
      plan,
      intent: input.intent ?? plan.intent,
      parentRunId: effectiveParent,
      ...(input.callTool ? { callTool: input.callTool } : {}),
      ...(input.loader ? { loader: input.loader } : {}),
      ...(input.skipKnowledge !== undefined ? { skipKnowledge: input.skipKnowledge } : {}),
      runtimeMode: input.runtimeMode ?? "deterministic",
    });
    specialist_results.push(out.result);
    agent_runs.push(out.agent_run);
  }

  stages.push(
    stageOk("agent", {
      agent_count: agent_runs.length,
      agents: agent_runs.map((a) => a.agent_id).join(","),
    }, runId),
  );

  const skillFailed = specialist_results.some((r) =>
    (r.warnings ?? []).some((w) => w.includes("skill_failed")),
  );
  if (skillFailed) {
    stages.push(stageFail("skill", "skill_error", "skill_failed_in_specialist", runId));
  } else {
    stages.push(
      stageOk("skill", {
        skill_run_count: specialist_results.reduce(
          (n, r) => n + (r.skill_run_ids?.length ?? 0),
          0,
        ),
      }, runId),
    );
  }

  stages.push(
    stageOk("tool", {
      tool_call_count: specialist_results.reduce(
        (n, r) => n + (r.tool_call_ids?.length ?? 0),
        0,
      ),
    }, runId),
  );
  stages.push(
    stageOk("rag", {
      skipped: Boolean(input.skipKnowledge),
      citation_count: specialist_results.reduce(
        (n, r) => n + (r.citations?.length ?? 0),
        0,
      ),
    }, runId),
  );
  const memWarn = specialist_results.some((r) =>
    (r.warnings ?? []).some((w) => w.includes("memory")),
  );
  if (memWarn) {
    stages.push(stageFail("memory", "memory_error", "memory_unavailable", runId));
  } else {
    stages.push(
      stageOk("memory", {
        memory_count: specialist_results.reduce(
          (n, r) => n + (r.memory_ids?.length ?? 0),
          0,
        ),
      }, runId),
    );
  }

  // --- 5. Merge / conflict resolution ---
  let workingSnapshot = snapshot;
  if (inject.safetyRejection) {
    workingSnapshot = {
      ...snapshot,
      safety: {
        ...snapshot.safety,
        escalateCare: true,
        ok: false,
        reasons: [...snapshot.safety.reasons, "prod_runtime_force_escalate"],
      },
    };
  }

  const merge = mergeSpecialistProposals({
    specialistResults: specialist_results,
    snapshot: workingSnapshot,
    safety: workingSnapshot.safety,
    userId,
    runId: effectiveParent,
  });

  let proposal = merge.selected;
  if (proposal && !proposal.context_id) {
    proposal = {
      ...proposal,
      context_id: workingSnapshot.inputFingerprint,
      user_id: workingSnapshot.userId,
    };
  }

  if (inject.invalidProposal) {
    // Force engine mode conflict: snapshot rest + proposal FULL (same as E2E harness)
    if (
      workingSnapshot.decisions.trainingMode === "full" ||
      workingSnapshot.decisions.trainingMode === "express"
    ) {
      workingSnapshot = {
        ...workingSnapshot,
        decisions: {
          ...workingSnapshot.decisions,
          trainingMode: "rest",
          trainingVolume: 0,
        },
        safety: { ...workingSnapshot.safety, preferLightTraining: true },
      };
    }
    proposal = buildInvalidProposal(workingSnapshot, userId);
  } else if (inject.safetyRejection) {
    proposal = buildUnsafeProposal(workingSnapshot, userId);
  }

  stages.push(
    stageOk("proposal", {
      merge_reason: merge.resolution_reason,
      conflict_count: merge.conflicts.length,
      proposal_id: proposal?.proposal_id ?? null,
    }, runId),
  );

  if (input.skipBridge) {
    const correlation = collectCorrelation(
      runId,
      parentRunId,
      specialist_results,
      proposal,
      null,
      workingSnapshot.inputFingerprint,
    );
    recordAudit({
      kind: "agent_run",
      user_id: userId,
      subject_id: runId,
      run_id: runId,
      status: proposal ? "completed" : "failed",
      summary: proposal ? "canonical_runtime:merge_only" : "canonical_runtime:no_proposal",
      metadata: {
        [AI_PATH_LABEL_META_KEY]: AI_PATH_LABEL.CANONICAL,
        skip_bridge: true,
        merge_reason: merge.resolution_reason,
      },
    });
    return {
      ok: Boolean(proposal),
      degraded: !proposal,
      path_label: AI_PATH_LABEL.CANONICAL,
      ...(proposal ? {} : { error_code: "no_proposal" as const, reason: merge.resolution_reason }),
      plan,
      specialist_results,
      agent_runs,
      merge,
      proposal,
      bridge: null,
      decision: null,
      living_plan: null,
      outcome: null,
      learning: null,
      stage_results: stages,
      correlation,
    };
  }

  if (!proposal) {
    stages.push(stageFail("proposal", "proposal_error", merge.resolution_reason || "no_proposal", runId));
    return failResult({
      runId,
      parentRunId,
      stages,
      error_code: "no_proposal",
      reason: merge.resolution_reason || "no_proposal",
      plan,
      merge,
      specialist_results,
      agent_runs,
      snapshotFp: workingSnapshot.inputFingerprint,
    });
  }

  // --- 6–7. Safety + Decision Engine bridge ---
  const bridge = await runAuthoritativeBridge({
    proposal,
    snapshot: workingSnapshot,
    runId: effectiveParent,
    emitOutcomeAndLearning: input.emitOutcomeAndLearning ?? false,
  });
  stages.push(...bridge.stages);

  const correlation = collectCorrelation(
    runId,
    parentRunId,
    specialist_results,
    proposal,
    bridge,
    workingSnapshot.inputFingerprint,
  );

  recordAudit({
    kind: "agent_run",
    user_id: userId,
    subject_id: runId,
    run_id: runId,
    parent_run_id: parentRunId ?? undefined,
    status: bridge.ok ? "completed" : "failed",
    summary: bridge.ok
      ? `canonical_runtime:decision:${bridge.decision?.decision_id ?? "ok"}`
      : `canonical_runtime:${bridge.reason ?? "bridge_failed"}`,
    context_fingerprint: workingSnapshot.inputFingerprint,
    metadata: {
      [AI_PATH_LABEL_META_KEY]: AI_PATH_LABEL.CANONICAL,
      proposal_id: proposal.proposal_id,
      decision_id: bridge.decision?.decision_id ?? null,
      merge_reason: merge.resolution_reason,
      emit_outcome_learning: input.emitOutcomeAndLearning ?? false,
    },
  });
  stages.push(
    stageOk("audit", {
      run_id: runId,
      decision_id: bridge.decision?.decision_id ?? null,
      path_label: AI_PATH_LABEL.CANONICAL,
    }, runId),
  );

  if (!bridge.ok) {
    const code = (bridge.error_code ?? "bridge_failed") as ProductionAiRuntimeErrorCode;
    return {
      ok: false,
      degraded: true,
      path_label: AI_PATH_LABEL.CANONICAL,
      error_code: code,
      reason: bridge.reason ?? "bridge_failed",
      plan,
      specialist_results,
      agent_runs,
      merge,
      proposal,
      bridge,
      decision: bridge.decision,
      living_plan: null,
      outcome: null,
      learning: null,
      stage_results: stages,
      correlation,
    };
  }

  return {
    ok: true,
    degraded: bridge.degraded,
    path_label: AI_PATH_LABEL.CANONICAL,
    plan,
    specialist_results,
    agent_runs,
    merge,
    proposal,
    bridge,
    decision: bridge.decision,
    living_plan: bridge.living_plan,
    outcome: bridge.outcome,
    learning: bridge.learning,
    stage_results: stages,
    correlation,
  };
}

function buildInvalidProposal(
  snapshot: DecisionContextSnapshot,
  userId: string,
): DecisionProposal {
  const created_at = new Date().toISOString();
  // Always propose FULL against a rest/recovery-biased snapshot (caller mutates mode first)
  return {
    proposal_id: `prop_invalid_${snapshot.inputFingerprint.slice(0, 8)}`,
    user_id: userId,
    context_id: snapshot.inputFingerprint,
    created_at,
    source: "agent",
    proposed_type: "FULL_WORKOUT",
    proposed_value: "full",
    reason_codes: ["plateau_detected"],
    confidence: 0.9,
    confidence_breakdown: { evidence_confidence: 0.5 },
  };
}

function buildUnsafeProposal(
  snapshot: DecisionContextSnapshot,
  userId: string,
): DecisionProposal {
  const created_at = new Date().toISOString();
  return {
    proposal_id: `prop_unsafe_${snapshot.inputFingerprint.slice(0, 8)}`,
    user_id: userId,
    context_id: snapshot.inputFingerprint,
    created_at,
    source: "agent",
    proposed_type: "FULL_WORKOUT",
    proposed_value: "full",
    reason_codes: ["escalate_care"],
    confidence: 0.9,
    confidence_breakdown: { evidence_confidence: 0.5 },
  };
}
