/**
 * Live eval: deterministic production runtime against a small intent set.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { clearAuditLog } from "@/ai/governance/audit";
import { LIVE_RUNTIME_CASES, scoreLiveRuntime } from "@/ai/governance/eval/live-runtime";
import { runProductionAiRuntime } from "@/ai/runtime/production-runtime";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { buildQaScenario } from "@/lib/qa/scenarios";
import {
  clearAgentRegistry,
  clearAgentRunLog,
  registerDefaultAgents,
} from "@/ai/agents";
import { clearSkillRegistry, clearSkillRunLog, registerAllSkills } from "@/ai/skills";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { clearToolRegistry } from "@/ai/mcp/core/registry";
import { resetMemoryInfrastructure } from "@/ai/memory";
import {
  clearKnowledgeStore,
  registerAllKnowledgeSources,
  resetEmbeddingProvider,
  resetVectorStore,
  seedProductionCorpus,
} from "@/ai/rag";
import type { SkillCallTool } from "@/ai/skills";

const USER = "user-live-eval-0001";
const DATE = "2026-03-11";

const mockCallTool: SkillCallTool = async (toolId, input) => {
  switch (toolId) {
    case "get_recovery":
      return {
        ok: true,
        data: { recovery: { score: 70, level: "ok", readiness: "ready", fatigueSignal: false } },
      };
    case "get_sleep":
      return { ok: true, data: { sleep: { hours: 7.5, source: "checkin", avg7d: 7.2 } } };
    case "get_wearable_data":
      return { ok: true, data: { wearable: { available: false, confidence: null } } };
    case "get_training_history":
      return {
        ok: true,
        data: {
          sessions: [
            { id: "s1", date: DATE, title: "Squat", durationMin: 50 },
            { id: "s2", date: DATE, title: "Push", durationMin: 40 },
          ],
        },
      };
    case "get_current_plan":
      return {
        ok: true,
        data: {
          plan: { date: DATE, workoutMode: "full" },
          decisions: { trainingMode: "full", trainingVolume: 1 },
        },
      };
    case "get_training_session":
      return { ok: true, data: { session: { id: "s1", title: "Squat" } } };
    case "get_recent_decisions":
      return { ok: true, data: { decisions: [], trainingMode: "full" } };
    case "get_recent_outcomes":
      return { ok: true, data: { outcomes: [] } };
    case "get_nutrition":
      return {
        ok: true,
        data: { nutrition: { mealsLoggedToday: 2, proteinAdherence7d: 0.8, kcalTrend: 0 } },
      };
    case "get_user_goal":
      return { ok: true, data: { goal: "massa" } };
    case "get_user_profile":
      return { ok: true, data: { profile: { goal: "massa" } } };
    case "get_products":
      return { ok: true, data: { products: [] } };
    case "search_knowledge":
      return { ok: true, data: { hits: [], query: input?.["query"] ?? null } };
    case "get_knowledge_document":
      return { ok: true, data: { ok: true, chunks: [] } };
    default:
      return { ok: false, error_code: "unauthorized_tool" };
  }
};

function snapshot() {
  const state = { ...buildQaScenario("healthy_full", { date: DATE }), userId: USER };
  return assembleDecisionContext(state, { date: DATE, userId: USER, source: "offline_legacy" });
}

beforeEach(async () => {
  clearAuditLog();
  clearAgentRunLog();
  clearSkillRunLog();
  clearAgentRegistry();
  clearSkillRegistry();
  clearToolRegistry();
  resetVectorStore();
  clearKnowledgeStore();
  resetEmbeddingProvider();
  resetMemoryInfrastructure();
  registerDefaultAgents({ force: true });
  registerAllSkills({ force: true });
  registerAllMcpTools({ force: true });
  registerAllKnowledgeSources({ force: true });
  await seedProductionCorpus();
});

describe("live deterministic runtime eval", () => {
  it.each(LIVE_RUNTIME_CASES)("$case_id", async (expectCase) => {
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: expectCase.intent,
      snapshot: snapshot(),
      callTool: mockCallTool,
      runtimeMode: "deterministic",
      skipBridge: true,
    });
    const score = scoreLiveRuntime(expectCase, out);
    expect(score.detail).toBe("ok");
    expect(score.passed).toBe(true);
  }, 60_000);
});
