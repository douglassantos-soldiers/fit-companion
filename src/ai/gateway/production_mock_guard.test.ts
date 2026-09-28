/**
 * FASE 22.5 — Production mock provider hard guard.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  invokeAI,
  generateWithFallback,
  ProductionMockProviderError,
  resolvePrimaryProvider,
  resolveLlmEnvironment,
} from "@/ai/gateway";
import { getProvider, resetProviderRegistry, setProviderForTests, makeAIError } from "@/ai/providers";
import type { AIProvider, AIRequest, AIResult, AIUsage } from "@/ai/providers";
import { getMockAIProvider, resetMockAIProvider } from "@/ai/providers/mock";

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

beforeEach(() => {
  process.env["VITEST"] = "true";
  delete process.env["AI_LLM_ENV"];
  delete process.env["AI_PRIMARY_PROVIDER"];
  delete process.env["AI_FALLBACK_PROVIDER"];
  resetMockAIProvider();
  resetProviderRegistry();
});

afterEach(() => {
  process.env["VITEST"] = PREV["VITEST"] ?? "true";
  for (const k of ["AI_LLM_ENV", "AI_PRIMARY_PROVIDER", "AI_FALLBACK_PROVIDER"]) {
    if (PREV[k] !== undefined) process.env[k] = PREV[k]!;
    else delete process.env[k];
  }
  resetProviderRegistry();
});

describe("FASE 22.5 production_mock_guard", () => {
  it("getProvider(mock) throws ProductionMockProviderError in production", () => {
    process.env["AI_LLM_ENV"] = "production";
    delete process.env["VITEST"];
    expect(() => getProvider("mock")).toThrow(ProductionMockProviderError);
  });

  it("AI_PRIMARY_PROVIDER=mock throws ProductionMockProviderError", () => {
    process.env["AI_LLM_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_PRIMARY_PROVIDER"] = "mock";
    expect(() => resolvePrimaryProvider()).toThrow(ProductionMockProviderError);
  });

  it("invokeAI with mock never succeeds in production", async () => {
    process.env["AI_LLM_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_PRIMARY_PROVIDER"] = "openai";
    expect(resolveLlmEnvironment()).toBe("production");

    const res = await invokeAI({
      agentId: "specialist_training",
      userId: "user-mock-guard",
      userContent: "treino",
      runtimeMode: "hybrid",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe("aborted");
      expect(res.execution_mode).toBe("hybrid");
      expect(res.error.message).toMatch(/mock|forbidden/i);
    }
  });

  it("generateWithFallback strips mock secondary in production", async () => {
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

  it("deterministic skip labels: execution_mode, provider none, status aborted", async () => {
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: "user-mock-guard",
      userContent: "x",
      runtimeMode: "deterministic",
      provider: "mock",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.execution_mode).toBe("deterministic");
      expect(res.provider).toBe("none");
      expect(res.model).toBe("deterministic_runtime");
      expect(res.status).toBe("aborted");
    }
  });

  it("mock allowed in test env", async () => {
    expect(resolveLlmEnvironment()).toBe("test");
    const p = getProvider("mock");
    expect(p.id).toBe("mock");
    getMockAIProvider().setOpts({});
    const res = await invokeAI({
      agentId: "specialist_training",
      userId: "user-mock-guard",
      userContent: "treino",
      runtimeMode: "hybrid",
      provider: "mock",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.execution_mode).toBe("hybrid");
      expect(res.status).toBe("ok");
      expect(res.provider).toBe("mock");
    }
  });
});
