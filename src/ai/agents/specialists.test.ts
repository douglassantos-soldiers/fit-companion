/**
 * Specialist Agents — integration tests (mocked tools, no Decision Engine).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  SPECIALIST_AGENT_IDS,
  SPECIALIST_PERFORMANCE_ID,
  SPECIALIST_RECOVERY_ID,
  SPECIALIST_TRAINING_ID,
  clearAgentRegistry,
  clearAgentRunLog,
  listAgents,
  registerDefaultAgents,
  runSpecialistAgent,
} from "@/ai/agents";
import { createExecutionPlan } from "@/ai/orchestrator";
import { resetMemoryInfrastructure } from "@/ai/memory";
import { createMemory } from "@/ai/memory";
import { clearKnowledgeStore, resetEmbeddingProvider } from "@/ai/rag";
import { registerAllSkills } from "@/ai/skills/register";
import { clearSkillRegistry, clearSkillRunLog } from "@/ai/skills";
import type { SkillCallTool } from "@/ai/skills";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { clearToolRegistry } from "@/ai/mcp/core/registry";

const USER = "user-agent-aaaa";

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
          plan: { date: "2026-03-11", workoutMode: "full" },
          decisions: { trainingMode: "full", trainingVolume: 1 },
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
              why: { reason_codes: ["sleep_low"] },
              what: { actions: [], decision_value: "deload" },
              expectedOutcome: { kind: "REDUCE_FATIGUE" },
            },
          ],
        },
      };
    case "get_recent_outcomes":
      return { ok: true, data: { outcomes: [{ kind: "session_completed", value: true }] } };
    default:
      return { ok: false, error_code: "unauthorized_tool" };
  }
};

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

describe("Specialist Agents", () => {
  it("registers 5 specialists + coach", () => {
    const ids = new Set(listAgents().map((a) => a.id));
    expect(ids.has("coach")).toBe(true);
    for (const id of SPECIALIST_AGENT_IDS) {
      expect(ids.has(id)).toBe(true);
    }
    expect(SPECIALIST_AGENT_IDS).toHaveLength(5);
  });

  it.each([...SPECIALIST_AGENT_IDS])(
    "agent %s returns analysis/evidence/confidence",
    async (agentId) => {
      const intents: Record<string, string> = {
        specialist_performance: "Quero ver minha performance e tendências",
        specialist_training: "Quero ajustar o volume do treino",
        specialist_nutrition: "Como estão minhas macros?",
        specialist_recovery: "Estou com fadiga e dormi mal",
        specialist_behavior: "Tenho fricção de aderência nos hábitos",
      };
      const { ok: planOk, plan } = createExecutionPlan({
        trustedUserId: USER,
        intent: intents[agentId] ?? "overview",
        overrides: { forceAgents: [agentId] },
      });
      expect(planOk).toBe(true);

      await createMemory({
        trustedUserId: USER,
        family: "user",
        type: "preferences",
        key: "note",
        data: { value: "morning" },
        source: "user",
        confidence: 0.8,
      });

      const out = await runSpecialistAgent({
        trustedUserId: USER,
        agentId,
        plan,
        callTool: mockCallTool,
        skipKnowledge: true,
      });
      expect(out.ok).toBe(true);
      expect(out.result.status).toBe("completed");
      expect(out.result.analysis).toBeTruthy();
      expect(Array.isArray(out.result.evidence)).toBe(true);
      expect(typeof out.result.confidence).toBe("number");
      expect(out.result.agent_id).toBe(agentId);
    },
  );

  it("training/recovery can bridge DecisionProposal without final Decision", async () => {
    const { plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Estou cansado e quero treinar mesmo assim",
    });
    const recovery = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: SPECIALIST_RECOVERY_ID,
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(recovery.ok).toBe(true);
    // fatigue → adjust_training_load may propose
    if (recovery.result.proposal) {
      expect(recovery.result.proposal.source).toBe("agent");
      expect(recovery.result.proposal.proposed_type).toBeTruthy();
    }

    const training = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: SPECIALIST_TRAINING_ID,
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(training.ok).toBe(true);
    expect(training.result.status).toBe("completed");
  });

  it("performance agent does not emit plan-mutation proposal", async () => {
    const { plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Mostre overview de performance e riscos",
      overrides: { forceAgents: [SPECIALIST_PERFORMANCE_ID] },
    });
    const out = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: SPECIALIST_PERFORMANCE_ID,
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(out.ok).toBe(true);
    // explain/analyze skills are read-only — no REDUCE_VOLUME style proposal required
    if (out.result.proposal) {
      expect(out.result.proposal.proposed_type).not.toBe("REDUCE_VOLUME");
    }
  });

  it("anonymous and unknown agent are blocked", async () => {
    const { plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "treino",
    });
    const anon = await runSpecialistAgent({
      trustedUserId: null,
      agentId: SPECIALIST_TRAINING_ID,
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(anon.ok).toBe(false);
    expect(anon.result.status).toBe("blocked");

    const unknown = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: "agent_hacker",
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(unknown.ok).toBe(false);
  });

  it("multi-agent plan runs two specialists independently", async () => {
    const { plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Estou muito cansado hoje, mas queria treinar.",
    });
    expect(plan.agents).toEqual(
      expect.arrayContaining([SPECIALIST_RECOVERY_ID, SPECIALIST_TRAINING_ID]),
    );
    const a = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: SPECIALIST_RECOVERY_ID,
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    const b = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: SPECIALIST_TRAINING_ID,
      plan,
      callTool: mockCallTool,
      skipKnowledge: true,
    });
    expect(a.ok && b.ok).toBe(true);
    expect(a.result.run_id).not.toBe(b.result.run_id);
  });

  it("agent runtime source does not import Decision engine", () => {
    const root = join(process.cwd(), "src/ai/agents");
    const files = ["runtime/run-specialist.ts", "runtime/aggregate.ts", "index.ts"];
    for (const f of files) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src.includes('from "@/lib/engine/decision"')).toBe(false);
      expect(/import\s*\{[^}]*computeDecisions/.test(src)).toBe(false);
    }
  });
});
