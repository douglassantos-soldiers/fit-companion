/**
 * AI Gateway — unit tests (mock provider; no live LLM).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { clearAuditLog, listAudits } from "@/ai/governance/audit";
import {
  invokeAI,
  parseStructuredOutput,
  validateAndBridgeStructured,
} from "@/ai/gateway";
import { withRetry } from "@/ai/gateway/retry";
import { generateWithFallback } from "@/ai/gateway/fallback";
import {
  getMockAIProvider,
  resetMockAIProvider,
} from "@/ai/providers/mock";
import type { AIRequest } from "@/ai/providers/types";
import { clearAgentRunLog, runSpecialistAgent } from "@/ai/agents";
import { createExecutionPlan } from "@/ai/orchestrator";
import { registerDefaultAgents, clearAgentRegistry } from "@/ai/agents";
import { registerAllSkills, clearSkillRegistry, clearSkillRunLog } from "@/ai/skills";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { clearToolRegistry } from "@/ai/mcp/core/registry";
import { resetMemoryInfrastructure } from "@/ai/memory";
import { clearKnowledgeStore, resetEmbeddingProvider } from "@/ai/rag";
import type { SkillCallTool } from "@/ai/skills";

const USER = "user-gateway-test01";

const mockCallTool: SkillCallTool = async (toolId) => {
  if (toolId === "get_training_history") {
    return {
      ok: true,
      data: {
        sessions: [{ id: "s1", date: "2026-03-11", title: "Squat", durationMin: 50 }],
      },
    };
  }
  if (toolId === "get_current_plan") {
    return {
      ok: true,
      data: {
        plan: { date: "2026-03-11", workoutMode: "express" },
        decisions: { trainingMode: "express", trainingVolume: 0.7 },
      },
    };
  }
  return { ok: true, data: {} };
};

beforeEach(() => {
  clearAuditLog();
  clearAgentRunLog();
  resetMockAIProvider();
  clearAgentRegistry();
  clearSkillRegistry();
  clearSkillRunLog();
  clearToolRegistry();
  resetMemoryInfrastructure();
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerDefaultAgents();
  registerAllSkills();
  registerAllMcpTools();
  delete process.env["AI_RUNTIME_MODE"];
  delete process.env["AI_PRIMARY_PROVIDER"];
  delete process.env["AI_FALLBACK_PROVIDER"];
  delete process.env["AI_LLM_ENV"];
  process.env["VITEST"] = "true";
});

describe("AI Gateway structured validate", () => {
  it("accepts valid structured JSON", () => {
    const text = JSON.stringify({
      analysis: { ok: true },
      evidence: [{ signal: "a", value: 1, source: "t" }],
      confidence: 0.8,
      proposal: {
        proposed_type: "EXPRESS_WORKOUT",
        proposed_value: "express",
        reason_codes: ["time_limited"],
        confidence: 0.7,
      },
    });
    const parsed = parseStructuredOutput(text);
    expect("analysis" in parsed).toBe(true);
    if ("analysis" in parsed) {
      expect(parsed.confidence).toBe(0.8);
      expect(parsed.proposal?.proposed_type).toBe("EXPRESS_WORKOUT");
    }
  });

  it("rejects invalid schema fail-closed", () => {
    const bad = parseStructuredOutput("{not json");
    expect("analysis" in bad).toBe(false);
    if (!("analysis" in bad)) expect(bad.code).toBe("invalid_structured_output");

    const noEvidence = parseStructuredOutput(
      JSON.stringify({ analysis: {}, confidence: 0.5 }),
    );
    expect("analysis" in noEvidence).toBe(false);

    const bridged = validateAndBridgeStructured({
      text: JSON.stringify({
        analysis: { x: 1 },
        evidence: [{ signal: "s", value: "v" }],
        confidence: 0.9,
        proposal: {
          proposed_type: "EXPRESS_WORKOUT",
          proposed_value: "express",
          reason_codes: ["time_limited"],
          confidence: 0.8,
        },
      }),
      agentId: "specialist_training",
      userId: USER,
    });
    expect("structured" in bridged).toBe(true);
    if ("structured" in bridged) {
      expect(bridged.decision_proposal?.proposed_type).toBe("EXPRESS_WORKOUT");
      expect(bridged.decision_proposal?.source).toBe("agent");
    }
  });

  it("rejects safety markers", () => {
    const out = validateAndBridgeStructured({
      text: JSON.stringify({
        analysis: { note: "__bypass_safety__" },
        evidence: [{ signal: "s", value: 1 }],
        confidence: 0.5,
        proposal: null,
      }),
      agentId: "specialist_training",
      userId: USER,
    });
    expect("structured" in out).toBe(false);
    if (!("structured" in out)) expect(out.code).toBe("safety_rejection");
  });
});

describe("AI Gateway invokeAI", () => {
  it("mock generate structured OK", async () => {
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      runId: "ar_test_1",
      userContent: JSON.stringify({ intent: "treino curto" }),
      runtimeMode: "hybrid",
      provider: "mock",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.provider).toBe("mock");
      expect(res.structured?.confidence).toBeGreaterThan(0);
      expect(res.decision_proposal?.proposed_type).toBe("EXPRESS_WORKOUT");
      expect(res.usage.input_tokens).toBeGreaterThan(0);
      expect(res.prompt_version).toBeTruthy();
    }
    const audits = listAudits(50).filter((a) => a.kind === "ai_gateway");
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0]?.metadata?.["provider"]).toBe("mock");
    expect(audits[0]?.token_usage?.input).toBeGreaterThan(0);
  });

  it("schema inválido rejeitado", async () => {
    getMockAIProvider().setOpts({ responseBody: { foo: "bar" } });
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "{}",
      runtimeMode: "llm",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("invalid_structured_output");
  });

  it("runtime_mode=deterministic não chama provider", async () => {
    getMockAIProvider().setOpts({ failWith: "upstream", failMessage: "should_not_run" });
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "x",
      runtimeMode: "deterministic",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("not_configured");
  });

  it("cost limit abort", async () => {
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "treino",
      runtimeMode: "hybrid",
      provider: "mock",
      request: { max_cost: 0 },
    });
    // preflight or provider cost_limit
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(["cost_limit", "not_configured"]).toContain(res.error.code);
      // with max_cost 0, preflight should trip
      expect(res.error.code).toBe("cost_limit");
    }
  });

  it("fallback primary→mock", async () => {
    process.env["OPENAI_API_KEY"] = "";
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: JSON.stringify({ intent: "treino" }),
      runtimeMode: "hybrid",
      provider: "openai",
      fallbackProvider: "mock",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.provider).toBe("mock");
      expect(res.fallback_used).toBe(true);
    }
  });
});

describe("AI Gateway retry", () => {
  it("retries rate_limit then succeeds", async () => {
    getMockAIProvider().setOpts({ failWith: "rate_limit", failTimes: 1 });
    const { result, attempts } = await withRetry(() =>
      getMockAIProvider().generate({
        messages: [{ role: "user", content: "hi" }],
        json_mode: true,
      }),
    );
    expect(result.ok).toBe(true);
    expect(attempts.length).toBe(2);
  });

  it("does not retry unauthorized", async () => {
    getMockAIProvider().setOpts({ failWith: "unauthorized" });
    const { result, attempts } = await withRetry(() =>
      getMockAIProvider().generate({
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized");
    expect(attempts.length).toBe(1);
  });

  it("does not retry safety_rejection via fallback short-circuit", async () => {
    getMockAIProvider().setOpts({
      responseBody: {
        analysis: { note: "__unsafe_override__" },
        evidence: [{ signal: "s", value: 1 }],
        confidence: 0.5,
        proposal: null,
      },
    });
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "x",
      runtimeMode: "llm",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("safety_rejection");
  });
});

describe("AI Gateway fallback generateWithFallback", () => {
  it("uses secondary after primary not_configured", async () => {
    const req: AIRequest = {
      messages: [{ role: "user", content: "hello" }],
      json_mode: true,
      max_tokens: 100,
    };
    const { result, trace } = await generateWithFallback(req, "anthropic", "mock");
    expect(result.ok).toBe(true);
    expect(trace[0]?.provider).toBe("anthropic");
    expect(trace[0]?.ok).toBe(false);
    expect(trace[1]?.provider).toBe("mock");
    expect(trace[1]?.ok).toBe(true);
  });
});

describe("specialist_training gateway wiring", () => {
  it("deterministic mode não chama provider", async () => {
    getMockAIProvider().setOpts({ failWith: "upstream", failMessage: "no_call" });
    const { plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "ajustar treino express",
    });
    const { ok, result, agent_run } = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: "specialist_training",
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
      runtimeMode: "deterministic",
    });
    expect(ok).toBe(true);
    expect(result.status).toBe("completed");
    expect(agent_run.metadata?.["runtime_mode"]).toBe("deterministic");
    expect(agent_run.metadata?.["deterministic_runtime"]).toBe(true);
    expect(agent_run.metadata?.["provider"]).toBe("none");
    expect(agent_run.metadata?.["execution_mode"]).toBe("deterministic");
    expect(agent_run.metadata?.["status"]).toBeTruthy();
  });

  it("hybrid training: proposal ainda é DecisionProposal candidata", async () => {
    const { plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "treino curto hoje",
    });
    const { ok, result, agent_run } = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: "specialist_training",
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
      runtimeMode: "hybrid",
      aiProvider: "mock",
    });
    expect(ok).toBe(true);
    expect(result.status).toBe("completed");
    expect(agent_run.metadata?.["provider"]).toBe("mock");
    expect(agent_run.metadata?.["prompt_version"]).toBeTruthy();
    expect(agent_run.metadata?.["input_tokens"]).toBeGreaterThan(0);
    expect(agent_run.metadata?.["runtime_mode"]).toBe("hybrid");
    // Proposal is candidate shape for Decision Engine — never Decision
    if (result.proposal) {
      expect(result.proposal.source).toBe("agent");
      expect(result.proposal.proposed_type).toBeTruthy();
      expect("decision_id" in result.proposal).toBe(false);
    }
    const audits = listAudits(100).filter((a) => a.kind === "agent_run");
    const last = audits[audits.length - 1];
    expect(last?.token_usage?.input).toBeGreaterThan(0);
    expect(last?.metadata?.["provider"]).toBe("mock");
  });

  it("llm mode fails observably when provider errors", async () => {
    getMockAIProvider().setOpts({ failWith: "unauthorized" });
    const { plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "treino",
    });
    const { ok, result, agent_run } = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: "specialist_training",
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
      runtimeMode: "llm",
      aiProvider: "mock",
    });
    expect(ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(agent_run.metadata?.["gateway_error"]).toBe("unauthorized");
  });
});
