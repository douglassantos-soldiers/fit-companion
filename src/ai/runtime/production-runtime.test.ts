/**
 * FASE 22.1 — Canonical production AI runtime tests.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { clearAuditLog, listAudits } from "@/ai/governance/audit";
import { runProductionAiRuntime } from "@/ai/runtime/production-runtime";
import { AI_PATH_LABEL } from "@/ai/runtime/path-labels";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { buildQaScenario } from "@/lib/qa/scenarios";
import {
  clearAgentRegistry,
  clearAgentRunLog,
  registerDefaultAgents,
} from "@/ai/agents";
import { registerAllSkills, clearSkillRegistry, clearSkillRunLog } from "@/ai/skills";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { clearToolRegistry } from "@/ai/mcp/core/registry";
import { resetMemoryInfrastructure } from "@/ai/memory";
import { clearKnowledgeStore, resetEmbeddingProvider } from "@/ai/rag";
import type { SkillCallTool } from "@/ai/skills";

const USER = "user-canonical-rt01";
const DATE = "2026-03-11";

const mockCallTool: SkillCallTool = async (toolId) => {
  switch (toolId) {
    case "get_recovery":
      return {
        ok: true,
        data: {
          recovery: { score: 35, level: "low", readiness: "low", fatigueSignal: true },
        },
      };
    case "get_sleep":
      return { ok: true, data: { sleep: { hours: 5, source: "checkin", avg7d: 5.5 } } };
    case "get_wearable_data":
      return {
        ok: true,
        data: { wearable: { available: false, confidence: null, restingHr: null, hrv: null } },
      };
    case "get_training_history":
      return {
        ok: true,
        data: {
          sessions: [
            { id: "s1", date: DATE, title: "Squat", durationMin: 50 },
            { id: "s2", date: DATE, title: "Push", durationMin: 40 },
            { id: "s3", date: DATE, title: "Pull", durationMin: 45 },
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
    case "get_recent_decisions":
      return { ok: true, data: { decisions: [], trainingMode: "full" } };
    case "get_nutrition":
      return {
        ok: true,
        data: {
          nutrition: { mealsLoggedToday: 0, proteinAdherence7d: 0.5, kcalTrend: 0 },
        },
      };
    case "get_user_goal":
      return { ok: true, data: { goal: "massa" } };
    case "get_user_profile":
      return { ok: true, data: { profile: { goal: "massa" } } };
    default:
      return { ok: true, data: { mock: true, toolId } };
  }
};

function snapshotFor(userId = USER) {
  const state = { ...buildQaScenario("healthy_full", { date: DATE }), userId };
  return assembleDecisionContext(state, {
    date: DATE,
    userId,
    source: "offline_legacy",
  });
}

beforeEach(() => {
  clearAuditLog();
  clearAgentRunLog();
  clearSkillRunLog();
  clearAgentRegistry();
  clearSkillRegistry();
  clearToolRegistry();
  clearKnowledgeStore();
  resetEmbeddingProvider();
  resetMemoryInfrastructure();
  registerDefaultAgents();
  registerAllSkills();
  registerAllMcpTools();
});

describe("runProductionAiRuntime — CANONICAL", () => {
  it("happy path: Decision + living_plan ref + audit + correlation", async () => {
    const snapshot = snapshotFor();
    expect(snapshot).toBeTruthy();

    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "como está minha recuperação",
      snapshot,
      forceAgents: ["specialist_recovery", "specialist_training"],
      callTool: mockCallTool,
      skipKnowledge: true,
      emitOutcomeAndLearning: false,
      parentRunId: "parent_canon_1",
    });

    expect(out.path_label).toBe(AI_PATH_LABEL.CANONICAL);
    expect(out.ok).toBe(true);
    expect(out.decision).toBeTruthy();
    expect(out.decision?.decision_id).toMatch(/^dec_/);
    expect(out.living_plan).toBeTruthy();
    expect(out.outcome).toBeNull();
    expect(out.learning).toBeNull();
    expect(out.correlation.run_id).toMatch(/^prod_/);
    expect(out.correlation.parent_run_id).toBe("parent_canon_1");
    expect(out.correlation.context_fingerprint).toBe(snapshot!.inputFingerprint);
    expect(out.correlation.decision_id).toBe(out.decision?.decision_id ?? null);

    const audits = listAudits();
    expect(audits.some((a) => a.kind === "decision" || a.summary?.includes("canonical_runtime"))).toBe(
      true,
    );
  });

  it("invalid identity", async () => {
    const snapshot = snapshotFor();
    const out = await runProductionAiRuntime({
      trustedUserId: null,
      intent: "x",
      snapshot,
    });
    expect(out.ok).toBe(false);
    expect(out.degraded).toBe(true);
    expect(out.error_code).toBe("invalid_identity");
    expect(out.decision).toBeNull();
  });

  it("missing context", async () => {
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot: null,
    });
    expect(out.ok).toBe(false);
    expect(out.error_code).toBe("missing_context");
    expect(out.decision).toBeNull();
  });

  it("specialist failure inject — no invented Decision", async () => {
    const snapshot = snapshotFor();
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot,
      inject: { specialistFailure: true },
    });
    expect(out.ok).toBe(false);
    expect(out.error_code).toBe("specialist_failure");
    expect(out.decision).toBeNull();
    expect(out.living_plan).toBeNull();
  });

  it("skill failure inject", async () => {
    const snapshot = snapshotFor();
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot,
      inject: { skillFailure: true },
    });
    expect(out.ok).toBe(false);
    expect(out.error_code).toBe("skill_failure");
    expect(out.decision).toBeNull();
  });

  it("tool failure inject", async () => {
    const snapshot = snapshotFor();
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot,
      inject: { toolFailure: true },
    });
    expect(out.ok).toBe(false);
    expect(out.error_code).toBe("tool_error");
    expect(out.decision).toBeNull();
  });

  it("RAG failure inject", async () => {
    const snapshot = snapshotFor();
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot,
      inject: { ragFailure: true },
    });
    expect(out.ok).toBe(false);
    expect(out.error_code).toBe("rag_error");
    expect(out.decision).toBeNull();
  });

  it("memory failure inject", async () => {
    const snapshot = snapshotFor();
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot,
      inject: { memoryFailure: true },
    });
    expect(out.ok).toBe(false);
    expect(out.error_code).toBe("memory_error");
    expect(out.decision).toBeNull();
  });

  it("invalid proposal → Decision Engine rejection", async () => {
    const snapshot = snapshotFor();
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot,
      forceAgents: ["specialist_training"],
      callTool: mockCallTool,
      skipKnowledge: true,
      inject: { invalidProposal: true },
      emitOutcomeAndLearning: false,
    });
    expect(out.ok).toBe(false);
    expect(out.degraded).toBe(true);
    expect(out.living_plan).toBeNull();
    expect(
      out.error_code === "proposal_error" ||
        out.error_code === "decision_error" ||
        out.error_code === "safety_rejection",
    ).toBe(true);
  });

  it("safety rejection", async () => {
    const snapshot = snapshotFor();
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot,
      forceAgents: ["specialist_training"],
      callTool: mockCallTool,
      skipKnowledge: true,
      inject: { safetyRejection: true },
      emitOutcomeAndLearning: false,
    });
    expect(out.ok).toBe(false);
    expect(out.error_code).toBe("safety_rejection");
    expect(out.decision).toBeNull();
    expect(out.living_plan).toBeNull();
  });

  it("idempotencyKey stabilizes run_id", async () => {
    const snapshot = snapshotFor();
    const a = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot,
      forceAgents: ["specialist_training"],
      callTool: mockCallTool,
      skipKnowledge: true,
      skipBridge: true,
      idempotencyKey: "stable-key-42",
    });
    const b = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "x",
      snapshot,
      forceAgents: ["specialist_training"],
      callTool: mockCallTool,
      skipKnowledge: true,
      skipBridge: true,
      idempotencyKey: "stable-key-42",
    });
    expect(a.correlation.run_id).toBe(b.correlation.run_id);
    expect(a.correlation.run_id).toMatch(/^prod_/);
  });

  it("audit generation on successful Decision", async () => {
    clearAuditLog();
    const snapshot = snapshotFor();
    const out = await runProductionAiRuntime({
      trustedUserId: USER,
      intent: "treino",
      snapshot,
      forceAgents: ["specialist_training"],
      callTool: mockCallTool,
      skipKnowledge: true,
      emitOutcomeAndLearning: false,
    });
    expect(out.ok).toBe(true);
    const related = listAudits().filter(
      (a) =>
        a.run_id === out.correlation.run_id ||
        a.parent_run_id === out.correlation.parent_run_id ||
        a.decision_id === out.decision?.decision_id,
    );
    expect(related.length).toBeGreaterThan(0);
    expect(
      listAudits().some(
        (a) =>
          a.metadata?.["path_label"] === AI_PATH_LABEL.CANONICAL ||
          a.kind === "decision",
      ),
    ).toBe(true);
  });
});
