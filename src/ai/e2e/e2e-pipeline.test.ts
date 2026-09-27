/**
 * FASE 15 — E2E pipeline harness tests (deterministic, no LLM).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { clearAgentRunLog } from "@/ai/agents/runtime/agent-run-log";
import { clearAuditLog, listAudits } from "@/ai/governance/audit";
import { clearRagRetrievalLog } from "@/ai/governance/rag-retrieval-log";
import { clearSkillRunLog } from "@/ai/skills/core/skill-run-log";
import { clearToolCallLog, recordToolCall } from "@/ai/mcp/core/tool-call-log";
import { registerDefaultAgents } from "@/ai/orchestrator/agents/registry";
import { registerAllSkills } from "@/ai/skills/register";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { runAiE2EPipeline } from "@/ai/e2e/run-pipeline";
import { buildAiExecutionTrace } from "@/ai/e2e/trace";
import type { ToolCall } from "@/ai/contracts/tool-call";

const USER = "user-e2e-aaaa";

beforeEach(() => {
  clearAgentRunLog();
  clearSkillRunLog();
  clearToolCallLog();
  clearAuditLog();
  clearRagRetrievalLog();
  registerDefaultAgents();
  registerAllSkills();
  registerAllMcpTools();
});

describe("tool-call-log skill_id vs skill_run_id", () => {
  it("never stores skill_run_id in audit.skill_id", () => {
    const call: ToolCall = {
      tool_call_id: "tc_1",
      tool: "get_training_history",
      tool_id: "get_training_history",
      run_id: "ar_1",
      agent_id: "specialist_training",
      user_id: USER,
      skill_run_id: "sr_should_not_be_skill_id",
      status: "completed",
      created_at: new Date().toISOString(),
    };
    recordToolCall(call);
    const audits = listAudits(20).filter((a) => a.kind === "tool_call");
    const last = audits[audits.length - 1];
    expect(last).toBeTruthy();
    expect(last!.skill_id).toBeUndefined();
    expect(last!.metadata?.["skill_run_id"]).toBe("sr_should_not_be_skill_id");
    expect(last!.tool_id).toBe("get_training_history");
    expect(String(last!.skill_id ?? "")).not.toMatch(/^sr_/);
  });
});

describe("runAiE2EPipeline failure modes", () => {
  it("wrong_user → authentication/authorization_error observável", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      inject: { wrongUser: true },
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(out.degraded).toBe(true);
    expect(out.error?.observable).toBe(true);
    expect(["authentication_error", "authorization_error"]).toContain(out.error?.code);
    expect(out.living_plan).toBeFalsy();
    expect(out.decision).toBeFalsy();
  });

  it("unauthorized_tool → authorization_error", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      inject: { unauthorizedTool: true },
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(out.degraded).toBe(true);
    expect(out.error?.code).toBe("authorization_error");
    expect(out.stage_results.some((s) => s.stage === "tool" && !s.ok)).toBe(true);
    expect(out.living_plan).toBeFalsy();
  });

  it("missing_context → context_error sem Decision inventada", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      inject: { missingContext: true },
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe("context_error");
    expect(out.decision).toBeFalsy();
    expect(out.living_plan).toBeFalsy();
  });

  it("invalid_proposal → proposal_error; sem Living Plan do bridge", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      inject: { invalidProposal: true },
      skipKnowledge: true,
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(out.degraded).toBe(true);
    expect(["proposal_error", "safety_rejection"]).toContain(out.error?.code);
    expect(out.living_plan).toBeFalsy();
  });

  it("safety_rejection → safety_rejection sem Living Plan inventado", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      inject: { safetyRejection: true },
      skipKnowledge: true,
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe("safety_rejection");
    expect(out.living_plan).toBeFalsy();
    expect(out.stage_results.some((s) => s.stage === "safety" && !s.ok)).toBe(true);
  });

  it("tool_failure → tool_error registrado", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      inject: { toolFailure: true },
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe("tool_error");
    expect(out.stage_results.some((s) => s.stage === "tool" && !s.ok)).toBe(true);
  });

  it("rag_failure → rag_error quando retrieval vazio", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      inject: { ragFailure: true },
      skipKnowledge: false,
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe("rag_error");
    expect(out.living_plan).toBeFalsy();
  });

  it("memory_failure → memory_error observável", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      inject: { memoryFailure: true },
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe("memory_error");
    expect(out.error?.observable).toBe(true);
  });

  it("decision_failure → decision_error / context_error", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      inject: { decisionFailure: true },
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(["decision_error", "context_error"]).toContain(out.error?.code);
    expect(out.living_plan).toBeFalsy();
  });
});

describe("runAuthoritativeBridge product mode", () => {
  it("emitOutcomeAndLearning:false resolve Decision sem inventar Outcome", async () => {
    const { assembleDecisionContext } = await import("@/lib/engine/assemble-decision-context");
    const { buildQaScenario } = await import("@/lib/qa/scenarios");
    const { buildProposalId } = await import("@/lib/engine/decision-proposal");
    const { runAuthoritativeBridge } = await import("@/ai/e2e/authoritative-bridge");

    const date = "2026-03-11";
    const state = { ...buildQaScenario("healthy_full", { date }), userId: USER };
    const snap = assembleDecisionContext(state, { date, userId: USER, source: "offline_legacy" });
    expect(snap).toBeTruthy();
    const mode = snap!.decisions.trainingMode;
    const proposed_type =
      mode === "rest"
        ? "REST"
        : mode === "deload"
          ? "DELOAD"
          : mode === "express"
            ? "EXPRESS_WORKOUT"
            : "FULL_WORKOUT";
    const created_at = new Date().toISOString();
    const proposal = {
      proposal_id: buildProposalId({
        userId: USER,
        proposedType: proposed_type,
        proposedValue: mode,
        createdAt: created_at,
      }),
      user_id: USER,
      context_id: snap!.inputFingerprint,
      proposed_type,
      proposed_value: mode,
      reason_codes: ["progression_ready" as const],
      confidence: 0.8,
      source: "coach" as const,
      created_at,
    };

    const bridge = runAuthoritativeBridge({
      proposal,
      snapshot: snap!,
      runId: "coach_prod_test_1",
      emitOutcomeAndLearning: false,
    });

    expect(bridge.ok).toBe(true);
    expect(bridge.decision?.decision_id).toBeTruthy();
    expect(bridge.living_plan).toBeTruthy();
    expect(bridge.outcome).toBeNull();
    expect(bridge.learning).toBeNull();
    expect(bridge.stages.some((s) => s.stage === "outcome")).toBe(false);
  });
});

describe("runAiE2EPipeline successful full pipeline", () => {
  it("successful_full_pipeline fecha Identity→Evaluation com trace", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      intent: "como está meu treino e fadiga",
      forceAgents: ["specialist_training"],
      skipKnowledge: true,
      runEvaluation: true,
    });

    expect(out.ok).toBe(true);
    expect(out.degraded).toBe(false);
    expect(out.error).toBeNull();
    expect(out.run_id).toMatch(/^e2e_/);

    const stageNames = out.stage_results.map((s) => s.stage);
    for (const required of [
      "identity",
      "context",
      "orchestrator",
      "agent",
      "skill",
      "tool",
      "proposal",
      "safety",
      "decision",
      "living_plan",
      "outcome",
      "learning",
      "audit",
      "evaluation",
    ] as const) {
      expect(stageNames).toContain(required);
      const st = out.stage_results.find((s) => s.stage === required);
      expect(st?.ok).toBe(true);
      expect(st?.observable).toBe(true);
    }

    expect(out.decision).toBeTruthy();
    expect(out.decision!.decision_id).toBeTruthy();
    expect(out.living_plan).toBeTruthy();
    expect(out.living_plan!.workout.mode).toBeTruthy();
    expect(out.outcome?.outcome_id).toBeTruthy();
    expect(out.learning).toBeTruthy();
    expect(out.evaluation?.failed).toBe(0);

    const trace = buildAiExecutionTrace(out.run_id, { stages: out.stage_results });
    expect(trace.reconstructed).toBe(true);
    expect(trace.run_id).toBe(out.run_id);
    expect(trace.decision_ids.length + (out.trace.decision_ids.length > 0 ? 1 : 0)).toBeGreaterThan(
      0,
    );
    expect(out.trace.decision_ids.length).toBeGreaterThan(0);
    expect(out.trace.outcome_ids.length).toBeGreaterThan(0);
    expect(out.trace.learning_event_ids.length).toBeGreaterThan(0);
    expect(out.trace.context_fingerprint || out.performance_context_fingerprint).toBeTruthy();
    expect(out.trace.agent_id).toBeTruthy();
  }, 60_000);
});
