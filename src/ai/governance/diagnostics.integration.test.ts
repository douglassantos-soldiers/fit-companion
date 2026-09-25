/**
 * Integration: specialist run → audit trail → diagnoseAgentRun.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { clearAgentRunLog } from "@/ai/agents/runtime/agent-run-log";
import { runSpecialistAgent } from "@/ai/agents/runtime/run-specialist";
import {
  buildAiAuditTrail,
  clearAuditLog,
  clearRagRetrievalLog,
  computeAiMetrics,
  diagnoseAgentRun,
} from "@/ai/governance";
import { clearSkillRunLog } from "@/ai/skills/core/skill-run-log";
import { clearToolCallLog } from "@/ai/mcp/core/tool-call-log";
import { createExecutionPlan } from "@/ai/orchestrator";
import { registerDefaultAgents } from "@/ai/orchestrator/agents/registry";
import { registerAllSkills } from "@/ai/skills/register";
import { registerAllMcpTools } from "@/ai/mcp/register";

const USER = "user-agent-aaaa";

beforeEach(() => {
  clearAgentRunLog();
  clearSkillRunLog();
  clearToolCallLog();
  clearAuditLog();
  clearRagRetrievalLog();
  registerDefaultAgents();
  registerAllSkills();
  registerAllMcpTools();
});

describe("diagnostics integration", () => {
  it("specialist run produces auditable trail and diagnostic answers", async () => {
    const { ok: planOk, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "como está meu treino e fadiga",
      contextAvailable: true,
      overrides: { forceAgents: ["specialist_training"] },
    });
    expect(planOk).toBe(true);
    expect(plan.status).toBe("ready");

    const out = await runSpecialistAgent({
      trustedUserId: USER,
      agentId: "specialist_training",
      plan,
      intent: "como está meu treino e fadiga",
      skipKnowledge: true,
      callTool: async () => ({ ok: true, data: { trainingMode: "express" } }),
    });

    expect(out.agent_run.run_id).toBeTruthy();
    expect(out.agent_run.metadata?.["agent_version"]).toBeTruthy();
    expect(out.agent_run.metadata?.["model"]).toBe("deterministic_runtime");

    const trail = buildAiAuditTrail(out.agent_run.run_id);
    expect(trail.agent_run?.run_id).toBe(out.agent_run.run_id);
    expect(trail.audits.some((a) => a.kind === "agent_run")).toBe(true);

    const diag = diagnoseAgentRun(out.agent_run.run_id);
    expect(diag.answers).toHaveLength(12);
    expect(diag.answers[0]?.value).toBe("specialist_training");
    expect(diag.sections.model_cost["model"]).toBe("deterministic_runtime");

    const metrics = computeAiMetrics();
    expect(metrics.sample_size.agents).toBeGreaterThanOrEqual(1);
  });
});
