/**
 * FASE 15 / 22.1 — End-to-end AI pipeline harness.
 *
 * @classification TEST_ONLY — not a production entrypoint.
 * Product path: askAiCoach → runCoachAgent → runProductionAiRuntime.
 * FASE 22.12: Real production E2E is `runProductionE2E` (DB/RAG/Memory/Audit remote).
 * This harness uses QA + mocks and must NOT be treated as production PASS.
 *
 * Identity → Context → (inject probes) → runProductionAiRuntime (CANONICAL)
 * → optional synthetic proposal (TEST ONLY) → Audit → Evaluation
 */
import { asTrustedUserId } from "@/ai/contracts/trusted-user-id";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import { buildProposalId } from "@/lib/engine/decision-proposal";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { toPerformanceContext } from "@/lib/engine/performance-context";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { Decision } from "@/lib/engine/decision-contract";
import type { LivingPlanSnapshot } from "@/lib/types";
import { emptyState, type AppState } from "@/lib/types";
import { buildQaScenario, type QaScenarioId } from "@/lib/qa/scenarios";
import { createExecutionPlan } from "@/ai/orchestrator/plan";
import { registerDefaultAgents } from "@/ai/orchestrator/agents/registry";
import { registerAllSkills } from "@/ai/skills/register";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { invokeTool } from "@/ai/mcp/core/invoke";
import { authorizeToolInvoke } from "@/ai/mcp/core/auth";
import { retrieveKnowledge } from "@/ai/rag/retrieval";
import { retrieveMemory } from "@/ai/memory/api";
import { runAiEvaluation } from "@/ai/governance/eval/runner";
import { recordAudit } from "@/ai/governance/audit";
import type { SkillCallTool } from "@/ai/skills/core/types";
import type { Outcome } from "@/ai/contracts/outcome";
import type { RunLearningCycleResult } from "@/lib/engine/learning/run-learning";
import {
  mapLayerErrorToPipeline,
  stageFail,
  stageOk,
  toPipelineError,
  type AiPipelineError,
  type PipelineStageResult,
} from "@/ai/e2e/errors";
import { buildAiExecutionTrace, type AiExecutionTrace } from "@/ai/e2e/trace";
import { runAuthoritativeBridge } from "@/ai/runtime/authoritative-bridge";
import { runProductionAiRuntime } from "@/ai/runtime/production-runtime";
import { AI_PATH_LABEL } from "@/ai/runtime/path-labels";

const FIXED_DATE = "2026-03-11";

export type AiE2EInject = {
  /** Fail identity (anonymous / invalid). */
  wrongUser?: boolean;
  /** Invoke a tool outside agent allowlist / unknown tool. */
  unauthorizedTool?: boolean;
  /** Assemble with empty profile → context_error. */
  missingContext?: boolean;
  /** Force proposal that conflicts with engine mode. */
  invalidProposal?: boolean;
  /** Force escalateCare + non-rest proposal → safety_rejection. */
  safetyRejection?: boolean;
  /** Force tool call to fail observably. */
  toolFailure?: boolean;
  /** Require RAG and treat empty/error as failure. */
  ragFailure?: boolean;
  /** Force memory retrieve to throw / fail. */
  memoryFailure?: boolean;
  /** Force decision assemble null / skip snapshot. */
  decisionFailure?: boolean;
};

export type RunAiE2EPipelineInput = {
  trustedUserId: string | null;
  intent?: string;
  scenarioId?: QaScenarioId;
  date?: string;
  forceAgents?: string[];
  inject?: AiE2EInject;
  skipKnowledge?: boolean;
  callTool?: SkillCallTool;
  /** When set, run evaluation suite at the end (default true on success path). */
  runEvaluation?: boolean;
};

export type RunAiE2EPipelineResult = {
  ok: boolean;
  degraded: boolean;
  run_id: string;
  parent_run_id: string | null;
  stage_results: PipelineStageResult[];
  trace: AiExecutionTrace;
  error: AiPipelineError | null;
  reason?: string;
  performance_context_fingerprint?: string;
  proposal?: DecisionProposal | null;
  decision?: Decision | null;
  living_plan?: LivingPlanSnapshot | null;
  outcome?: Outcome | null;
  learning?: RunLearningCycleResult | null;
  evaluation?: { passed: number; failed: number };
};

function newPipelineRunId(): string {
  return `e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildAlignedProposal(
  snapshot: DecisionContextSnapshot,
  userId: string,
): DecisionProposal {
  const mode = snapshot.decisions.trainingMode;
  const proposed_type =
    mode === "rest"
      ? "REST"
      : mode === "deload"
        ? "DELOAD"
        : mode === "express"
          ? "EXPRESS_WORKOUT"
          : "FULL_WORKOUT";
  const proposed_value = mode;
  const created_at = new Date().toISOString();
  return {
    proposal_id: buildProposalId({
      userId,
      proposedType: proposed_type,
      proposedValue: proposed_value,
      createdAt: created_at,
    }),
    user_id: userId,
    context_id: snapshot.inputFingerprint,
    proposed_type,
    proposed_value,
    reason_codes: ["progression_ready"],
    confidence: 0.85,
    source: "agent",
    created_at,
  };
}

function buildConflictingProposal(
  snapshot: DecisionContextSnapshot,
  userId: string,
): DecisionProposal {
  const created_at = new Date().toISOString();
  return {
    proposal_id: buildProposalId({
      userId,
      proposedType: "FULL_WORKOUT",
      proposedValue: "full",
      createdAt: created_at,
    }),
    user_id: userId,
    context_id: snapshot.inputFingerprint,
    proposed_type: "FULL_WORKOUT",
    proposed_value: "full",
    reason_codes: ["plateau_detected"],
    confidence: 0.9,
    source: "agent",
    created_at,
  };
}

function buildUnsafeProposal(
  snapshot: DecisionContextSnapshot,
  userId: string,
): DecisionProposal {
  const created_at = new Date().toISOString();
  return {
    proposal_id: buildProposalId({
      userId,
      proposedType: "FULL_WORKOUT",
      proposedValue: "full",
      createdAt: created_at,
    }),
    user_id: userId,
    context_id: snapshot.inputFingerprint,
    proposed_type: "FULL_WORKOUT",
    proposed_value: "full",
    reason_codes: ["escalate_care"],
    confidence: 0.9,
    source: "agent",
    created_at,
  };
}

function finishDegraded(
  runId: string,
  stages: PipelineStageResult[],
  reason: string,
  extra?: Partial<RunAiE2EPipelineResult>,
): RunAiE2EPipelineResult {
  const failed = [...stages].reverse().find((s) => !s.ok) ?? null;
  const error = failed ? toPipelineError(failed) : {
    code: "decision_error" as const,
    stage: "decision" as const,
    message: reason,
    observable: true as const,
    run_id: runId,
  };
  const trace = buildAiExecutionTrace(runId, { stages });
  return {
    ok: false,
    degraded: true,
    run_id: runId,
    parent_run_id: null,
    stage_results: stages,
    trace,
    error,
    reason,
    ...extra,
  };
}

/**
 * TEST ONLY — full deterministic AI journey for tests / hardening.
 * Failures degrade safely and never invent Decision / Living Plan.
 *
 * @classification TEST_ONLY
 */
export async function runAiE2EPipeline(
  input: RunAiE2EPipelineInput,
): Promise<RunAiE2EPipelineResult> {
  registerDefaultAgents();
  registerAllSkills();
  registerAllMcpTools();

  const runId = newPipelineRunId();
  const stages: PipelineStageResult[] = [];
  const inject = input.inject ?? {};
  const date = input.date ?? FIXED_DATE;
  const intent = input.intent ?? "como está meu treino e fadiga";
  const forceAgents = input.forceAgents ?? ["specialist_training"];

  // --- 1. Trusted Identity ---
  if (inject.wrongUser || !input.trustedUserId?.trim()) {
    stages.push(
      stageFail(
        "identity",
        inject.wrongUser || !input.trustedUserId?.trim()
          ? input.trustedUserId && input.trustedUserId.length >= 8
            ? "authorization_error"
            : "authentication_error"
          : "authentication_error",
        inject.wrongUser ? "wrong_user" : "anonymous_denied",
        runId,
      ),
    );
    // wrongUser with a valid-looking id still fails authz when we treat as forged
    if (inject.wrongUser && input.trustedUserId && input.trustedUserId.length >= 8) {
      stages[stages.length - 1] = stageFail(
        "identity",
        "authorization_error",
        "wrong_user",
        runId,
      );
    }
    return finishDegraded(runId, stages, stages[stages.length - 1]?.message ?? "identity_failed");
  }

  let userId: string;
  try {
    userId = asTrustedUserId(input.trustedUserId);
  } catch {
    stages.push(
      stageFail("identity", "authentication_error", "invalid_trusted_user_id", runId),
    );
    return finishDegraded(runId, stages, "invalid_trusted_user_id");
  }
  stages.push(stageOk("identity", { user_id: userId.slice(0, 8) }, runId));

  // --- 2. Context ---
  let state: AppState;
  if (inject.missingContext) {
    state = { ...emptyState, userId };
  } else {
    state = buildQaScenario(input.scenarioId ?? "healthy_full", { date });
    state = { ...state, userId };
  }

  let snapshot: DecisionContextSnapshot | null = null;
  if (inject.decisionFailure) {
    stages.push(stageFail("context", "context_error", "decision_failure_injected", runId));
    // still mark context attempted
  } else if (inject.missingContext || !state.profile) {
    stages.push(stageFail("context", "context_error", "missing_context_or_profile", runId));
    return finishDegraded(runId, stages, "missing_context");
  } else {
    snapshot = assembleDecisionContext(state, {
      date,
      userId,
      source: "offline_legacy",
    });
    if (!snapshot) {
      stages.push(stageFail("context", "context_error", "assemble_decision_context_null", runId));
      return finishDegraded(runId, stages, "context_unavailable");
    }
    const pc = toPerformanceContext(snapshot, state);
    stages.push(
      stageOk("context", {
        fingerprint: snapshot.inputFingerprint,
        confidence: pc.confidence,
      }, runId),
    );
  }

  if (inject.decisionFailure || !snapshot) {
    if (!stages.some((s) => s.stage === "context" && !s.ok)) {
      stages.push(stageFail("decision", "decision_error", "decision_failure_injected", runId));
    } else {
      stages.push(stageFail("decision", "decision_error", "no_snapshot", runId));
    }
    return finishDegraded(runId, stages, "decision_failure");
  }

  // Safety injection on snapshot (mutable copy for escalateCare)
  if (inject.safetyRejection) {
    snapshot = {
      ...snapshot,
      safety: {
        ...snapshot.safety,
        escalateCare: true,
        ok: false,
        reasons: [...snapshot.safety.reasons, "e2e_force_escalate"],
      },
    };
  }

  // --- 3. Orchestrator ---
  const { ok: planOk, plan } = createExecutionPlan({
    trustedUserId: userId,
    intent,
    contextAvailable: true,
    overrides: { forceAgents },
  });
  if (!planOk || plan.status !== "ready") {
    const planReason =
      "rejection_reason" in plan && typeof plan.rejection_reason === "string"
        ? plan.rejection_reason
        : plan.status;
    stages.push(
      stageFail(
        "orchestrator",
        mapLayerErrorToPipeline(planReason, "context"),
        planReason,
        runId,
        { plan_status: plan.status },
      ),
    );
    return finishDegraded(runId, stages, planReason);
  }
  stages.push(
    stageOk("orchestrator", {
      plan_id: plan.plan_id,
      agents: plan.agents.join(","),
    }, runId),
  );

  // --- 4–8. Agent + Skill + Tool + RAG + Memory ---
  const defaultCallTool: SkillCallTool =
    input.callTool ??
    (async (toolId) => {
      if (inject.toolFailure) {
        return { ok: false, error_code: "tool_failed" };
      }
      if (inject.unauthorizedTool) {
        return { ok: false, error_code: "unauthorized_tool" };
      }
      return { ok: true, data: { e2e_mock: true, toolId } };
    });

  // Explicit unauthorized tool stage (observable before agent)
  if (inject.unauthorizedTool) {
    const authz = authorizeToolInvoke({
      trustedUserId: userId,
      tool: undefined,
    });
    if (!authz.ok) {
      stages.push(
        stageFail("tool", "authorization_error", authz.error_code, runId, {
          tool_id: "not_allowed_tool_xyz",
        }),
      );
      await invokeTool({
        toolId: "not_allowed_tool_xyz",
        trustedUserId: userId,
        agentId: forceAgents[0] ?? "specialist_training",
        runId,
        input: {},
      });
      return finishDegraded(runId, stages, "unauthorized_tool");
    }
  }

  if (inject.toolFailure) {
    // Record a failed tool call in the audit trail under this run
    const failRes = await (async () => {
      const callTool = defaultCallTool;
      return callTool("get_training_history", {});
    })();
    if (!failRes.ok) {
      recordAudit({
        kind: "tool_call",
        user_id: userId,
        subject_id: `tc_e2e_fail_${runId}`,
        run_id: runId,
        agent_id: forceAgents[0] ?? "specialist_training",
        tool_id: "get_training_history",
        status: "failed",
        summary: "failed:tool_failed",
        metadata: { error_code: "tool_failed", e2e: true },
      });
      stages.push(
        stageFail("tool", "tool_error", "tool_failed", runId, {
          tool_id: "get_training_history",
        }),
      );
      return finishDegraded(runId, stages, "tool_failure");
    }
  }

  // Memory probe
  if (inject.memoryFailure) {
    try {
      await retrieveMemory({
        trustedUserId: "",
        family: "user",
        limit: 1,
      });
      stages.push(stageFail("memory", "memory_error", "expected_memory_auth_failure", runId));
    } catch (e) {
      stages.push(
        stageFail(
          "memory",
          "memory_error",
          e instanceof Error ? e.message : "memory_failure",
          runId,
        ),
      );
    }
    return finishDegraded(runId, stages, "memory_failure");
  }

  // RAG probe when required
  if (inject.ragFailure) {
    try {
      const { retrieval } = await retrieveKnowledge({
        query: "force empty rag e2e __no_corpus_match__",
        domains: ["exercise"],
        topK: 3,
        mode: "hybrid",
        audit: { userId, runId, agentId: forceAgents[0] ?? "specialist_training" },
      });
      const hits = retrieval.hits.length;
      if (hits === 0) {
        stages.push(
          stageFail("rag", "rag_error", "rag_empty_or_error", runId, {
            retrieval_id: retrieval.retrieval_id,
          }),
        );
        return finishDegraded(runId, stages, "rag_failure");
      }
    } catch (e) {
      stages.push(
        stageFail(
          "rag",
          "rag_error",
          e instanceof Error ? e.message : "rag_failure",
          runId,
        ),
      );
      return finishDegraded(runId, stages, "rag_failure");
    }
  }

  // --- 4–9. CANONICAL production runtime (merge only; harness owns inject + bridge) ---
  const canon = await runProductionAiRuntime({
    trustedUserId: userId,
    intent,
    snapshot,
    plan,
    forceAgents,
    parentRunId: runId,
    skipKnowledge: input.skipKnowledge ?? !inject.ragFailure,
    callTool: defaultCallTool,
    runtimeMode: "deterministic",
    emitOutcomeAndLearning: false,
    skipBridge: true,
    idempotencyKey: `e2e_${runId}`,
  });

  for (const s of canon.stage_results) {
    if (
      s.stage === "identity" ||
      s.stage === "context" ||
      s.stage === "orchestrator" ||
      s.stage === "audit"
    ) {
      continue;
    }
    stages.push(s);
  }

  const agentRuns = canon.agent_runs.map((a) => ({
    run_id: a.run_id,
    agent_id: a.agent_id,
    status: a.status,
  }));
  const lastAgentRunId = agentRuns[agentRuns.length - 1]?.run_id ?? runId;
  const merge = canon.merge;

  let proposal: DecisionProposal | null = canon.proposal
    ? {
        ...canon.proposal,
        user_id: userId,
        context_id: snapshot.inputFingerprint,
      }
    : null;

  if (inject.invalidProposal) {
    if (snapshot.decisions.trainingMode === "full") {
      snapshot = {
        ...snapshot,
        decisions: { ...snapshot.decisions, trainingMode: "rest", trainingVolume: 0 },
        safety: { ...snapshot.safety, preferLightTraining: true },
      };
    }
    proposal = buildConflictingProposal(snapshot, userId);
  } else if (inject.safetyRejection) {
    proposal = buildUnsafeProposal(snapshot, userId);
  } else if (!proposal) {
    // TEST ONLY: synthetic aligned when specialists emitted none
    proposal = buildAlignedProposal(snapshot, userId);
  }

  stages.push(
    stageOk("proposal", {
      merge_reason: merge.resolution_reason,
      conflict_count: merge.conflicts.length,
      candidate_count: merge.candidates.length,
      proposal_id: proposal?.proposal_id ?? null,
      path_label: AI_PATH_LABEL.TEST_ONLY,
    }, runId),
  );

  const bridge = await runAuthoritativeBridge({
    proposal,
    snapshot,
    runId,
    emitOutcomeAndLearning: true,
  });
  stages.push(...bridge.stages);

  if (!bridge.ok) {
    return finishDegraded(runId, stages, bridge.reason ?? "bridge_failed", {
      proposal,
      decision: bridge.decision,
      living_plan: null,
    });
  }

  // --- Audit (trail exists via record* helpers) ---
  stages.push(
    stageOk("audit", {
      decision_id: bridge.decision?.decision_id ?? null,
      outcome_id: bridge.outcome?.outcome_id ?? null,
    }, runId),
  );

  // --- Evaluation ---
  let evaluation: { passed: number; failed: number } | undefined;
  if (input.runEvaluation !== false) {
    try {
      const suite = runAiEvaluation();
      evaluation = { passed: suite.passed, failed: suite.failed };
      if (suite.failed > 0) {
        stages.push(
          stageFail("evaluation", "evaluation_error", `eval_failed:${suite.failed}`, runId, {
            passed: suite.passed,
            failed: suite.failed,
          }),
        );
        return finishDegraded(runId, stages, "evaluation_failed", {
          proposal,
          decision: bridge.decision,
          living_plan: bridge.living_plan,
          outcome: bridge.outcome ?? null,
          learning: bridge.learning,
          evaluation,
        });
      }
      stages.push(
        stageOk("evaluation", { passed: suite.passed, failed: suite.failed }, runId),
      );
    } catch (e) {
      stages.push(
        stageFail(
          "evaluation",
          "evaluation_error",
          e instanceof Error ? e.message : "evaluation_threw",
          runId,
        ),
      );
      return finishDegraded(runId, stages, "evaluation_error", {
        proposal,
        decision: bridge.decision,
        living_plan: bridge.living_plan,
      });
    }
  } else {
    stages.push(stageOk("evaluation", { skipped: true }, runId));
  }

  const trace = buildAiExecutionTrace(runId, { stages });
  for (const ar of agentRuns) {
    const childTrace = buildAiExecutionTrace(ar.run_id);
    trace.skill_ids = [...new Set([...trace.skill_ids, ...childTrace.skill_ids])];
    trace.skill_run_ids = [...new Set([...trace.skill_run_ids, ...childTrace.skill_run_ids])];
    trace.tool_ids = [...new Set([...trace.tool_ids, ...childTrace.tool_ids])];
    trace.tool_call_ids = [...new Set([...trace.tool_call_ids, ...childTrace.tool_call_ids])];
    trace.retrieval_ids = [...new Set([...trace.retrieval_ids, ...childTrace.retrieval_ids])];
    if (!trace.agent_id) trace.agent_id = childTrace.agent_id;
    if (!trace.agent_version) trace.agent_version = childTrace.agent_version;
  }
  if (!trace.context_fingerprint) {
    trace.context_fingerprint = snapshot.inputFingerprint;
  }
  // Parent correlation: decisions/outcomes recorded on pipeline runId
  trace.decision_ids = [
    ...new Set([
      ...trace.decision_ids,
      ...(bridge.decision ? [bridge.decision.decision_id] : []),
    ]),
  ];
  trace.outcome_ids = [
    ...new Set([
      ...trace.outcome_ids,
      ...(bridge.outcome ? [bridge.outcome.outcome_id] : []),
    ]),
  ];
  if (bridge.learning) {
    trace.learning_event_ids = [
      ...new Set([
        ...trace.learning_event_ids,
        ...bridge.learning.events.map((e) => e.event_id),
      ]),
    ];
  }

  recordAudit({
    kind: "agent_run",
    user_id: userId,
    subject_id: runId,
    run_id: runId,
    agent_id: "e2e_pipeline",
    agent_version: "1.0.0",
    context_fingerprint: snapshot.inputFingerprint,
    status: "completed",
    summary: "e2e_pipeline_ok",
    metadata: {
      model: "deterministic_runtime",
      child_agent_run: lastAgentRunId,
      agent_count: agentRuns.length,
      merge_reason: merge.resolution_reason,
      path_label: AI_PATH_LABEL.TEST_ONLY,
      canonical_run_id: canon.correlation.run_id,
    },
  });

  return {
    ok: true,
    degraded: false,
    run_id: runId,
    parent_run_id: null,
    stage_results: stages,
    trace,
    error: null,
    performance_context_fingerprint: snapshot.inputFingerprint,
    proposal,
    decision: bridge.decision,
    living_plan: bridge.living_plan,
    outcome: bridge.outcome,
    learning: bridge.learning ?? null,
    ...(evaluation ? { evaluation } : {}),
  };
}
