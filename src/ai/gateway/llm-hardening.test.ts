/**
 * FASE 22.4 — Production LLM Runtime hardening tests.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAuditLog, listAudits } from "@/ai/governance/audit";
import {
  checkAiCostLimits,
  checkLlmHealth,
  getLlmReadiness,
  invokeAI,
  recordAiCost,
  redactGatewayMetadata,
  resetAiCostLimits,
  resetCircuitBreakers,
  resolveLlmEnvironment,
  resolvePrimaryProvider,
  recordCircuitFailure,
  canCallProvider,
  getCircuitState,
} from "@/ai/gateway";
import { generateWithFallback } from "@/ai/gateway/fallback";
import {
  makeAIError,
  resetProviderRegistry,
  setProviderForTests,
  type AIProvider,
  type AIRequest,
  type AIResult,
  type AIUsage,
} from "@/ai/providers";
import { getMockAIProvider, resetMockAIProvider } from "@/ai/providers/mock";

const USER = "user-llm-harden-01";

const PREV = { ...process.env };

function fakeProvider(
  id: "openai" | "anthropic",
  impl: (req: AIRequest) => Promise<AIResult>,
): AIProvider {
  return {
    id,
    generate: impl,
    async stream() {
      return makeAIError("not_implemented", "no_stream", { provider: id });
    },
    estimateCost(u: AIUsage) {
      return ((u.input_tokens + u.output_tokens) / 1_000_000) * 0.5;
    },
    countTokens(t: string) {
      return Math.max(1, Math.ceil(t.length / 4));
    },
    async healthCheck() {
      return { ok: true, detail: "fake" };
    },
  };
}

const VALID_JSON = JSON.stringify({
  analysis: { ok: true },
  evidence: [{ signal: "t", value: 1, source: "test" }],
  confidence: 0.8,
  proposal: {
    proposed_type: "EXPRESS_WORKOUT",
    proposed_value: "express",
    reason_codes: ["time_limited"],
    confidence: 0.7,
  },
});

beforeEach(() => {
  process.env["VITEST"] = "true";
  delete process.env["AI_LLM_ENV"];
  delete process.env["AI_PRIMARY_PROVIDER"];
  delete process.env["AI_FALLBACK_PROVIDER"];
  delete process.env["AI_RUNTIME_MODE"];
  delete process.env["AI_LLM_ENABLED"];
  delete process.env["LLM_ENABLED"];
  delete process.env["AI_FORCE_DETERMINISTIC"];
  delete process.env["AI_COST_USER_DAY"];
  delete process.env["AI_COST_RUN_MAX"];
  delete process.env["AI_COST_DAY_MAX"];
  delete process.env["AI_CB_FAILURE_THRESHOLD"];
  resetMockAIProvider();
  resetProviderRegistry();
  resetCircuitBreakers();
  resetAiCostLimits();
  clearAuditLog();
});

afterEach(() => {
  process.env["VITEST"] = PREV["VITEST"] ?? "true";
  for (const k of [
    "AI_LLM_ENV",
    "AI_PRIMARY_PROVIDER",
    "AI_FALLBACK_PROVIDER",
    "AI_RUNTIME_MODE",
    "AI_LLM_ENABLED",
    "LLM_ENABLED",
    "AI_FORCE_DETERMINISTIC",
    "AI_COST_USER_DAY",
    "AI_COST_RUN_MAX",
    "AI_COST_DAY_MAX",
    "AI_CB_FAILURE_THRESHOLD",
  ]) {
    if (PREV[k] !== undefined) process.env[k] = PREV[k]!;
    else delete process.env[k];
  }
  resetProviderRegistry();
  resetCircuitBreakers();
  resetAiCostLimits();
});

describe("FASE 22.4 production LLM hardening", () => {
  it("provider success via mock in test", async () => {
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "treino",
      runtimeMode: "hybrid",
      provider: "mock",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.structured?.confidence).toBeGreaterThan(0);
      expect(res.request_id).toBeTruthy();
      expect(res.decision_proposal === null || res.decision_proposal.source === "agent").toBe(true);
    }
  });

  it("provider timeout", async () => {
    getMockAIProvider().setOpts({ failWith: "timeout" });
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "x",
      runtimeMode: "llm",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("timeout");
  });

  it("provider 429 / rate_limit", async () => {
    getMockAIProvider().setOpts({ failWith: "rate_limit", failTimes: 99 });
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "x",
      runtimeMode: "llm",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("rate_limit");
  });

  it("provider 500 / upstream", async () => {
    getMockAIProvider().setOpts({ failWith: "upstream", failMessage: "http_500" });
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "x",
      runtimeMode: "llm",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("upstream");
  });

  it("malformed JSON → invalid_structured_output", async () => {
    getMockAIProvider().setOpts({ responseBody: "not-json{{{" });
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "x",
      runtimeMode: "llm",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("invalid_structured_output");
  });

  it("invalid response schema fail-closed", async () => {
    getMockAIProvider().setOpts({
      responseBody: { analysis: {}, confidence: 0.5 },
    });
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "x",
      runtimeMode: "llm",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("invalid_structured_output");
  });

  it("cost exceeded per request", async () => {
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "treino",
      runtimeMode: "hybrid",
      provider: "mock",
      request: { max_cost: 0 },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("cost_limit");
  });

  it("cost exceeded per user day", async () => {
    process.env["AI_COST_USER_DAY"] = "0.01";
    await recordAiCost({ userId: USER, cost: 0.01 });
    const check = await checkAiCostLimits({ userId: USER, estimatedAdd: 0.001 });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.scope).toBe("user");

    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "treino curto",
      runtimeMode: "hybrid",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("cost_limit");
  });

  it("provider fallback A→B real (openai fail → anthropic fake)", async () => {
    setProviderForTests(
      "openai",
      fakeProvider("openai", async () =>
        makeAIError("upstream", "openai_boom", { provider: "openai", retryable: true }),
      ),
    );
    setProviderForTests(
      "anthropic",
      fakeProvider("anthropic", async () => ({
        ok: true,
        provider: "anthropic",
        model: "claude-fake",
        text: VALID_JSON,
        usage: { input_tokens: 10, output_tokens: 20, estimated_cost: 0.001, actual_cost: null },
        latency_ms: 5,
        request_id: "anth_req_1",
      })),
    );

    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "treino",
      runtimeMode: "hybrid",
      provider: "openai",
      fallbackProvider: "anthropic",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.provider).toBe("anthropic");
      expect(res.fallback_used).toBe(true);
      expect(res.request_id).toBe("anth_req_1");
    }
  });

  it("LLM disabled → deterministic skip", async () => {
    process.env["LLM_ENABLED"] = "false";
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "x",
      runtimeMode: "hybrid",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    expect(res.runtime_mode).toBe("deterministic");
    if (!res.ok) expect(res.error.message).toMatch(/deterministic/);
  });

  it("mock unavailable in production", async () => {
    process.env["AI_LLM_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_PRIMARY_PROVIDER"] = "openai";
    expect(resolveLlmEnvironment()).toBe("production");

    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      userContent: "x",
      runtimeMode: "hybrid",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/mock_forbidden|forbidden|provider === mock/i);
    }

    // Even getProvider('mock') throws in production
    const { getProvider } = await import("@/ai/providers/registry");
    expect(() => getProvider("mock")).toThrow(/mock|forbidden/i);
  });

  it("AI_PRIMARY_PROVIDER=mock forbidden in production", async () => {
    process.env["AI_LLM_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_PRIMARY_PROVIDER"] = "mock";
    expect(() => resolvePrimaryProvider()).toThrow(/forbidden in production/);
  });

  it("circuit breaker opens after N failures", async () => {
    process.env["AI_CB_FAILURE_THRESHOLD"] = "3";
    resetCircuitBreakers();
    recordCircuitFailure("openai");
    recordCircuitFailure("openai");
    expect(canCallProvider("openai")).toBe(true);
    recordCircuitFailure("openai");
    expect(getCircuitState("openai")).toBe("open");
    expect(canCallProvider("openai")).toBe(false);

    setProviderForTests(
      "openai",
      fakeProvider("openai", async () =>
        makeAIError("upstream", "should_not_call", { provider: "openai" }),
      ),
    );
    const { result, trace } = await generateWithFallback(
      { messages: [{ role: "user", content: "hi" }] },
      "openai",
    );
    expect(result.ok).toBe(false);
    expect(trace[0]?.circuit_skipped).toBe(true);
  });

  it("audit never stores secrets", () => {
    const redacted = redactGatewayMetadata({
      provider: "openai",
      api_key: "sk-secret-value",
      authorization: "Bearer sk-abc",
      note: "safe",
      token: "leak",
    });
    expect(redacted["api_key"]).toBeUndefined();
    expect(redacted["authorization"]).toBeUndefined();
    expect(redacted["token"]).toBeUndefined();
    expect(redacted["note"]).toBe("safe");
  });

  it("audit records request_id on success", async () => {
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: USER,
      runId: "run_audit_1",
      userContent: "treino",
      runtimeMode: "hybrid",
      provider: "mock",
    });
    expect(res.ok).toBe(true);
    const audits = listAudits(50).filter((a) => a.kind === "ai_gateway");
    const last = audits[audits.length - 1];
    expect(last?.metadata?.["request_id"]).toBeTruthy();
    expect(last?.metadata?.["input_tokens"]).toBeGreaterThan(0);
    expect(JSON.stringify(last)).not.toMatch(/sk-/);
  });

  it("checkLlmHealth + getLlmReadiness in test env", async () => {
    const health = await checkLlmHealth();
    expect(health.environment).toBe("test");
    expect(health.checks.find((c) => c.id === "mock_policy")?.ok).toBe(true);
    const ready = await getLlmReadiness();
    expect(ready.health).toBeTruthy();
    expect(ready.LLM_READY).toBe(true);
  });

  it("generateWithFallback strips mock in production chain", async () => {
    process.env["AI_LLM_ENV"] = "production";
    delete process.env["VITEST"];
    setProviderForTests(
      "openai",
      fakeProvider("openai", async () =>
        makeAIError("upstream", "fail", { provider: "openai", retryable: true }),
      ),
    );
    const { result, trace } = await generateWithFallback(
      { messages: [{ role: "user", content: "hi" }] },
      "openai",
      "mock",
    );
    expect(trace.every((t) => t.provider !== "mock")).toBe(true);
    expect(result.ok).toBe(false);
  });
});
