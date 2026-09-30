/**
 * MCP knowledge tools + Safety SAF levels.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { invokeTool } from "@/ai/mcp/core/invoke";
import { clearToolRegistry } from "@/ai/mcp/core/registry";
import {
  clearKnowledgeStore,
  registerAllKnowledgeSources,
  resetEmbeddingProvider,
  resetVectorStore,
  seedProductionCorpus,
} from "@/ai/rag";
import { evaluateSafetyForDate, matchSafetyNotes } from "@/lib/engine/safety";
import { emptyState } from "@/lib/types";
import { getPrompt } from "@/ai/gateway/prompts";
import { EVIDENCE_POLICY_COACH_BLOCK } from "@/ai/gateway/prompts/evidence-policy";
import { registerAllSkills } from "@/ai/skills/register";
import { hasSkill } from "@/ai/skills/core/registry";

beforeEach(async () => {
  resetVectorStore();
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerAllKnowledgeSources({ force: true });
  clearToolRegistry();
  registerAllMcpTools({ force: true });
  await seedProductionCorpus();
});

describe("MCP knowledge tools", () => {
  it("search_knowledge returns hits from Soldiers corpus", async () => {
    const res = await invokeTool({
      toolId: "search_knowledge",
      trustedUserId: "00000000-0000-4000-8000-000000000099",
      input: { query: "creatina monoidratada evidência", domains: ["supplementation"] },
    });
    expect(res.ok).toBe(true);
    const data = res.data as { hits?: unknown[] };
    expect(Array.isArray(data?.hits)).toBe(true);
  });

  it("get_knowledge_document blocks evidence-policy", async () => {
    const res = await invokeTool({
      toolId: "get_knowledge_document",
      trustedUserId: "00000000-0000-4000-8000-000000000099",
      input: { document_id: "evidence-policy-001" },
    });
    expect(res.ok).toBe(true);
    const data = res.data as { ok?: boolean; error?: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("document_blocked_from_rag");
  });
});

describe("Safety SAF levels", () => {
  it("classifies chest pain as EMERGENCY with fixed message", () => {
    const m = matchSafetyNotes("tô com dor no peito no meio do treino");
    expect(m.level).toBe("EMERGENCY");
    expect(m.ruleIds).toContain("SAF-100");
    expect(m.fixedMessage).toMatch(/SAMU/);
  });

  it("evaluateSafetyForDate exposes level and blockCommerce", () => {
    const date = "2026-09-29";
    const v = evaluateSafetyForDate(
      {
        ...emptyState,
        dayCheckIns: {
          [date]: {
            date,
            sleepHours: 7,
            energy: "ok",
            availableMin: 60,
            notes: "dor no peito",
          },
        },
      },
      date,
    );
    expect(v.level).toBe("EMERGENCY");
    expect(v.escalateCare).toBe(true);
    expect(v.ok).toBe(false);
    expect(v.blockCommerce).toBe(true);
    expect(v.fixedMessage).toBeTruthy();
  });
});

describe("Evidence policy prompts + supplement skill", () => {
  it("embeds EVP block in training prompt", () => {
    const p = getPrompt("specialist_training.v1");
    expect(p?.system).toContain("EVP-110");
    expect(p?.system).toContain(EVIDENCE_POLICY_COACH_BLOCK.slice(0, 40));
  });

  it("registers explain_supplement skill", () => {
    registerAllSkills({ force: true });
    expect(hasSkill("explain_supplement")).toBe(true);
  });
});
