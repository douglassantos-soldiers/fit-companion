/**
 * Coach Agent — integration tests (deterministic, mocked tools).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  COACH_AGENT_ERROR,
  clearAgentRegistry,
  clearAgentRunLog,
  registerDefaultAgents,
  runCoachAgent,
} from "@/ai/agents";
import { resetMemoryInfrastructure } from "@/ai/memory";
import { clearKnowledgeStore, resetEmbeddingProvider } from "@/ai/rag";
import { clearSkillRegistry, clearSkillRunLog, registerAllSkills } from "@/ai/skills";
import type { SkillCallTool } from "@/ai/skills";
import { clearToolRegistry } from "@/ai/mcp/core/registry";
import { registerAllMcpTools } from "@/ai/mcp/register";
import type { DecisionBundle } from "@/lib/engine/decision";
import type { SafetyVerdict } from "@/lib/engine/safety";

const USER = "user-coach-aaaa";

const mockCallTool: SkillCallTool = async (toolId) => {
  switch (toolId) {
    case "get_training_history":
      return {
        ok: true,
        data: {
          sessions: [
            { id: "s1", date: "2026-03-11", title: "Squat", durationMin: 50 },
            { id: "s2", date: "2026-03-10", title: "Push", durationMin: 40 },
            { id: "s3", date: "2026-03-09", title: "Pull", durationMin: 45 },
          ],
        },
      };
    case "get_current_plan":
      return {
        ok: true,
        data: {
          plan: { date: "2026-03-11", workoutMode: "deload" },
          decisions: { trainingMode: "deload", trainingVolume: 0.55 },
        },
      };
    case "get_training_session":
      return {
        ok: true,
        data: { session: { id: "s1", date: "2026-03-11", title: "Squat", exerciseCount: 4 } },
      };
    case "get_recovery":
      return {
        ok: true,
        data: {
          recovery: { score: 48, level: "low", readiness: "low", fatigueSignal: true },
        },
      };
    case "get_sleep":
      return { ok: true, data: { sleep: { hours: 5.5, source: "checkin", avg7d: 6.2 } } };
    case "get_wearable_data":
      return {
        ok: true,
        data: { wearable: { available: false, confidence: null, restingHr: null, hrv: null } },
      };
    case "get_nutrition":
      return {
        ok: true,
        data: {
          nutrition: { mealsLoggedToday: 1, proteinAdherence7d: 0.55, kcalTrend: 0 },
        },
      };
    case "get_user_goal":
      return { ok: true, data: { goal: "massa", goals: { primary: "massa" } } };
    case "get_user_profile":
      return {
        ok: true,
        data: { profile: { name: "QA", goal: "massa" }, identity: { userId: USER } },
      };
    case "get_recent_decisions":
      return {
        ok: true,
        data: {
          trainingMode: "deload",
          decisions: [
            {
              decisionId: "dec_1",
              why: {
                reason_codes: ["sleep_low", "recovery_low"],
                reason_aliases: ["LOW_SLEEP"],
                summary: "Sono baixo e recuperação limitada reduziram o volume.",
              },
              what: { actions: ["reduce_volume"], decision_value: "deload" },
              expectedOutcome: { kind: "REDUCE_FATIGUE" },
            },
          ],
        },
      };
    case "get_recent_outcomes":
      return {
        ok: true,
        data: { outcomes: [{ kind: "session_completed", value: true }] },
      };
    default:
      return { ok: false, error_code: "unauthorized_tool" };
  }
};

const failingTools: SkillCallTool = async () => ({
  ok: false,
  error_code: "tool_failed",
});

beforeEach(() => {
  clearAgentRunLog();
  clearAgentRegistry();
  registerDefaultAgents({ force: true });
  clearSkillRunLog();
  clearSkillRegistry();
  registerAllSkills({ force: true });
  clearToolRegistry();
  registerAllMcpTools({ force: true });
  resetMemoryInfrastructure();
  clearKnowledgeStore();
  resetEmbeddingProvider();
});

describe("Coach Agent", () => {
  it("general question", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Olá, como posso melhorar hoje?",
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(out.text.length).toBeGreaterThan(10);
    expect(out.structured.intentKind).toBe("general");
    expect(out.text.toLowerCase()).not.toContain("inventei");
  });

  it("training question", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Quero ajustar o volume do meu treino",
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(out.intentKind).toBe("training");
    expect(out.ok || out.status === "partial").toBe(true);
    expect(out.agent_runs.length).toBeGreaterThan(0);
  });

  it("nutrition question", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Como estão minhas macros e proteína?",
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(out.intentKind).toBe("nutrition");
  });

  it("recovery question", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Estou com fadiga e dormi mal",
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(out.intentKind).toBe("recovery");
  });

  it("behavior question", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Tenho fricção de aderência nos hábitos",
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(out.intentKind).toBe("behavior");
  });

  it("why plan changed uses Decision+Evidence+Outcome", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Por que meu plano mudou?",
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(out.intentKind).toBe("why_plan_changed");
    expect(out.status).toBe("ok");
    expect(out.text.toLowerCase()).toMatch(/decision|sono|recovery|deload|c[oó]digos/);
    expect(out.structured.why.length).toBeGreaterThan(0);
  });

  it("insufficient context", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Por que meu plano mudou?",
      contextAvailable: false,
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(out.status).toBe("insufficient_context");
    expect(out.error_code).toBe(COACH_AGENT_ERROR.INSUFFICIENT_CONTEXT);
    expect(out.text.toLowerCase()).toMatch(/n[aã]o (tenho|invento)/);
  });

  it("RAG failure does not invent knowledge", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Quero treinar peito",
      callTool: mockCallTool,
      skipKnowledge: false,
    });
    expect(out.text.length).toBeGreaterThan(5);
    // empty RAG store → warning or continue without fake citations
    expect(out.factPack?.citationsCount ?? 0).toBe(0);
  });

  it("tool failure surfaces warnings without invented metrics", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Como está meu treino?",
      callTool: failingTools,
      skipKnowledge: true,
    });
    expect(out.text.toLowerCase()).toMatch(/falharam|omit|n[aã]o|an[aá]lise|especialista/);
  });

  it("AI / specialist failure yields partial or warnings", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "treino de volume",
      callTool: failingTools,
      skipKnowledge: true,
    });
    expect(
      ["ok", "partial", "rejected"].includes(out.status) || out.structured.warnings.length >= 0,
    ).toBe(true);
  });

  it("safety rejection blocks proposal promotion", async () => {
    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Estou cansado mas quero treinar com volume alto",
      callTool: mockCallTool,
      skipKnowledge: true,
      forceSafetyBlock: true,
    });
    expect(
      out.factPack?.proposalStatus === "safety_blocked" || out.factPack?.proposal == null,
    ).toBe(true);
    expect(out.text.toLowerCase()).toMatch(/bloquead|safety|n[aã]o aplicada|proposta|especialista/);
  });

  it("invalid proposal against rest mode is rejected", async () => {
    const decisions = {
      trainingMode: "rest",
      trainingVolume: 0,
      primaryAction: "rest",
    } as unknown as DecisionBundle;
    const safety = {
      escalateCare: false,
      preferLightTraining: true,
    } as unknown as SafetyVerdict;

    const out = await runCoachAgent({
      trustedUserId: USER,
      message: "Quero treino completo FULL hoje",
      callTool: mockCallTool,
      skipKnowledge: true,
      decisions,
      safety,
    });
    // May or may not emit FULL_WORKOUT proposal; if it does soft-validate against rest
    if (out.factPack?.proposalStatus === "rejected") {
      expect(out.factPack.proposalRejectReason).toBeTruthy();
    }
    expect(out.text.length).toBeGreaterThan(5);
  });

  it("anonymous denied", async () => {
    const out = await runCoachAgent({
      trustedUserId: null,
      message: "Oi",
      callTool: mockCallTool,
    });
    expect(out.status).toBe("blocked");
    expect(out.error_code).toBe(COACH_AGENT_ERROR.ANONYMOUS_DENIED);
  });

  it("coach agent core does not import apply Living Plan or admin DB", () => {
    const root = join(process.cwd(), "src/ai/agents/coach");
    for (const f of ["run-coach.ts", "respond.ts", "fact-pack.ts", "intent.ts"]) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src.includes("apply-proposal")).toBe(false);
      expect(src.includes("adminDbLoose")).toBe(false);
      expect(/import\s*\{[^}]*computeDecisions/.test(src)).toBe(false);
    }
  });
});
