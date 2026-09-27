/**
 * FASE 21 — Flags, rate limit, cost bounds, rollback, durability.
 */
import { describe, expect, it, afterEach } from "vitest";
import { getAiFeatureFlags, isLlmFeatureAllowed } from "@/ai/runtime/feature-flags";
import { resolveEffectiveRuntimeMode, forceDeterministicRuntime } from "@/ai/runtime/rollback";
import { checkAiRateLimits, getAiRateLimitDefaults } from "@/ai/runtime/rate-limit";
import { assertCostBounds } from "@/ai/runtime/cost-bounds";
import { classifyAuditDurability } from "@/ai/governance/durability";
import { invokeAI } from "@/ai/gateway";
import type { AiAuditEvent } from "@/ai/governance/audit";

afterEach(() => {
  delete process.env["AI_FORCE_DETERMINISTIC"];
  delete process.env["AI_LLM_ENABLED"];
  delete process.env["AI_ENABLED"];
  delete process.env["AI_RAG_ENABLED"];
  delete process.env["AI_MEMORY_ENABLED"];
  delete process.env["AI_LEARNING_ENABLED"];
  delete process.env["AI_SPECIALISTS_ENABLED"];
  delete process.env["AI_RL_USER_RPM"];
});

function fakeAudit(partial: Partial<AiAuditEvent> & Pick<AiAuditEvent, "kind">): AiAuditEvent {
  return {
    audit_id: "a1",
    user_id: "u1",
    created_at: new Date().toISOString(),
    subject_id: "s1",
    governance_version: "g",
    contract_version: 1,
    ...partial,
  };
}

describe("FASE 21 flags + rollback + rate + cost", () => {
  it("cost bounds are finite and positive", () => {
    const c = assertCostBounds();
    expect(c.ok).toBe(true);
    expect(c.orchestrator.max_cost).toBeGreaterThan(0);
    expect(c.gateway.max_tokens).toBeGreaterThan(0);
  });

  it("AI_FORCE_DETERMINISTIC forces deterministic mode", () => {
    process.env["AI_FORCE_DETERMINISTIC"] = "1";
    process.env["AI_LLM_ENABLED"] = "1";
    expect(resolveEffectiveRuntimeMode("llm")).toBe("deterministic");
    expect(forceDeterministicRuntime()).toBe(true);
  });

  it("AI_LLM_ENABLED=0 blocks LLM even in hybrid", () => {
    process.env["AI_LLM_ENABLED"] = "0";
    expect(isLlmFeatureAllowed()).toBe(false);
    expect(resolveEffectiveRuntimeMode("hybrid")).toBe("deterministic");
  });

  it("feature flags defaults are safe", () => {
    const f = getAiFeatureFlags();
    expect(f.ai_enabled).toBe(true);
    // Unset AI_LLM_ENABLED + deterministic mode → llm_enabled false
    expect(f.llm_enabled).toBe(false);
    expect(f.rag_enabled).toBe(true);
  });

  it("rate limit eventually trips for same user key", () => {
    process.env["AI_RL_USER_RPM"] = "2";
    const userId = `rl_user_${Date.now()}`;
    expect(checkAiRateLimits({ userId }).ok).toBe(true);
    expect(checkAiRateLimits({ userId }).ok).toBe(true);
    expect(checkAiRateLimits({ userId }).ok).toBe(false);
    expect(getAiRateLimitDefaults().user_rpm).toBe(2);
  });

  it("invokeAI respects force deterministic", async () => {
    process.env["AI_FORCE_DETERMINISTIC"] = "1";
    process.env["AI_LLM_ENABLED"] = "1";
    const r = await invokeAI({
      agentId: "specialist_training",
      userContent: "x",
      runtimeMode: "llm",
      provider: "mock",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.runtime_mode).toBe("deterministic");
  });

  it("classifies decision and safety as critical", () => {
    expect(classifyAuditDurability(fakeAudit({ kind: "decision" }))).toBe("critical");
    expect(
      classifyAuditDurability(
        fakeAudit({ kind: "agent_run", status: "blocked_by_safety" }),
      ),
    ).toBe("critical");
    expect(
      classifyAuditDurability(
        fakeAudit({
          kind: "tool_call",
          status: "denied",
          metadata: { error_code: "unauthorized_tool" },
        }),
      ),
    ).toBe("critical");
    expect(classifyAuditDurability(fakeAudit({ kind: "rag_retrieval", status: "ok" }))).toBe(
      "observational",
    );
  });
});
