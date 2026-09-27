/**
 * FASE 21 — Failure modes fail-safe (no invented Decision).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { invokeAI } from "@/ai/gateway";
import { getMockAIProvider } from "@/ai/providers/mock";
import { runAiE2EPipeline } from "@/ai/e2e/run-pipeline";
import { retrieveKnowledge } from "@/ai/rag/retrieval";
import { loadAuditsAdmin } from "@/ai/governance/persist.server";

describe("FASE 21 failure modes", () => {
  afterEach(() => {
    getMockAIProvider().setOpts({});
    delete process.env["AI_FORCE_DETERMINISTIC"];
    delete process.env["AI_LLM_ENABLED"];
  });

  it("LLM unavailable / provider error is observable", async () => {
    process.env["AI_LLM_ENABLED"] = "1";
    getMockAIProvider().setOpts({ failWith: "upstream" });
    const r = await invokeAI({
      agentId: "specialist_training",
      userContent: "test",
      runtimeMode: "llm",
      provider: "mock",
      fallbackProvider: "mock",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBeTruthy();
  });

  it("LLM timeout path recorded", async () => {
    process.env["AI_LLM_ENABLED"] = "1";
    getMockAIProvider().setOpts({ failWith: "timeout" });
    const r = await invokeAI({
      agentId: "specialist_training",
      userContent: "test",
      runtimeMode: "llm",
      provider: "mock",
      fallbackProvider: "mock",
    });
    expect(r.ok).toBe(false);
  });

  it("force deterministic skips provider even in llm mode", async () => {
    process.env["AI_FORCE_DETERMINISTIC"] = "1";
    process.env["AI_LLM_ENABLED"] = "1";
    const r = await invokeAI({
      agentId: "specialist_training",
      userContent: "test",
      runtimeMode: "llm",
      provider: "mock",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.runtime_mode).toBe("deterministic");
  });

  it("RAG timeout returns empty citations (no invent)", async () => {
    const r = await retrieveKnowledge({ query: "recovery", timeoutMs: 0 });
    expect(r.citations).toEqual([]);
    expect(r.retrieval.rag_status === "timeout" || r.retrieval.rag_status === "skipped").toBe(true);
  });

  it("DB audit unavailable reports source", async () => {
    const loaded = await loadAuditsAdmin({ limit: 1 });
    expect(["db", "unavailable"]).toContain(loaded.source);
  });

  it("decision_failure inject does not invent Living Plan", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: "user-cert-fail",
      inject: { decisionFailure: true },
      runEvaluation: false,
    });
    expect(out.ok).toBe(false);
    expect(["decision_error", "context_error"]).toContain(out.error?.code);
    expect(out.living_plan).toBeFalsy();
  });
});
