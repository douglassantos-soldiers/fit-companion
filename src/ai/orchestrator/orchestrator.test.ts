/**
 * Orchestrator — unit tests (plan-only, no Decision/Runtime).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  ORCH_ERROR,
  clearAgentRegistry,
  createExecutionPlan,
  listAgents,
  registerDefaultAgents,
} from "@/ai/orchestrator";
import { registerAllSkills } from "@/ai/skills/register";
import { listTools } from "@/ai/mcp/core/registry";
import { registerAllMcpTools } from "@/ai/mcp/register";

const USER = "user-orch-aaaa";

beforeEach(() => {
  clearAgentRegistry();
  registerDefaultAgents({ force: true });
  registerAllSkills({ force: true });
  registerAllMcpTools({ force: true });
});

describe("Agent Orchestrator", () => {
  it("agent tool allowlists are MCP read tools", () => {
    const mcp = new Set(
      listTools("read").map((t) => t.id),
    );
    for (const agent of listAgents()) {
      for (const toolId of agent.allowed_tool_ids) {
        expect(mcp.has(toolId), `${agent.id} → ${toolId}`).toBe(true);
      }
    }
  });

  it("simple query → coach plan", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Olá, o que você recomenda hoje?",
    });
    expect(ok).toBe(true);
    expect(plan.status).toBe("ready");
    expect(plan.agents).toContain("coach");
    expect(plan.skills.length).toBeGreaterThan(0);
    expect(plan.estimatedCost).toBeGreaterThan(0);
  });

  it("training query → training specialist", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Quero ajustar o volume do meu treino",
    });
    expect(ok).toBe(true);
    expect(plan.agents).toContain("specialist_training");
    expect(plan.skills).toEqual(expect.arrayContaining(["analyze_training"]));
    expect(plan.knowledgeDomains).toEqual(expect.arrayContaining(["exercise", "performance"]));
    const handoffs = plan.sequence.filter((s) => s.kind === "handoff").map((s) => s.ref);
    expect(handoffs).toEqual(["context_engine", "safety_engine", "decision_engine"]);
  });

  it("supplementation query keeps explain_supplement and knowledge tools", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "posso tomar creatina com café?",
    });
    expect(ok).toBe(true);
    expect(plan.agents).toContain("specialist_nutrition");
    expect(plan.skills).toContain("explain_supplement");
    expect(plan.tools).toEqual(
      expect.arrayContaining(["search_knowledge", "get_knowledge_document", "get_products"]),
    );
    const warnings = plan.warnings ?? [];
    expect(warnings.some((w) => w.includes("explain_supplement"))).toBe(false);
    expect(warnings.some((w) => w.includes("search_knowledge"))).toBe(false);
  });

  it("training query keeps search_knowledge", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "como progressão de carga no treino?",
    });
    expect(ok).toBe(true);
    expect(plan.agents).toContain("specialist_training");
    expect(plan.tools).toContain("search_knowledge");
    expect((plan.warnings ?? []).some((w) => w.includes("search_knowledge"))).toBe(false);
  });

  it("nutrition query → nutrition specialist", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Como estão minhas macros e proteína?",
    });
    expect(ok).toBe(true);
    expect(plan.agents).toContain("specialist_nutrition");
    expect(plan.tools).toEqual(expect.arrayContaining(["get_nutrition"]));
  });

  it("recovery query → recovery specialist", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Estou com muita fadiga e dormi mal",
    });
    expect(ok).toBe(true);
    expect(plan.agents).toContain("specialist_recovery");
    expect(plan.skills.some((s) => s.startsWith("analyze_"))).toBe(true);
  });

  it("multi-agent query: cansado + treinar", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Estou muito cansado hoje, mas queria treinar.",
    });
    expect(ok).toBe(true);
    expect(plan.agents).toEqual(
      expect.arrayContaining(["specialist_recovery", "specialist_training"]),
    );
    expect(plan.sequence.some((s) => s.ref === "decision_engine")).toBe(true);
  });

  it("invalid agent is rejected", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "treino leve",
      overrides: { forceAgents: ["agent_hacker"] },
    });
    expect(ok).toBe(false);
    expect(plan.status).toBe("rejected");
    expect(plan.rejection_reason).toContain(ORCH_ERROR.INVALID_AGENT);
  });

  it("invalid tool is rejected", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "treino",
      overrides: {
        forceAgents: ["specialist_training"],
        forceTools: ["drop_all_tables"],
      },
    });
    expect(ok).toBe(false);
    expect(plan.rejection_reason).toContain(ORCH_ERROR.INVALID_TOOL);
  });

  it("loop is rejected when fingerprint matches parent", () => {
    const first = createExecutionPlan({
      trustedUserId: USER,
      intent: "Quero treinar peito",
    });
    expect(first.ok).toBe(true);
    const second = createExecutionPlan({
      trustedUserId: USER,
      intent: "Quero treinar peito",
      ...(first.plan.loop_fingerprint
        ? { parentPlanFingerprint: first.plan.loop_fingerprint }
        : {}),
    });
    expect(second.ok).toBe(false);
    expect(second.plan.rejection_reason).toBe(ORCH_ERROR.LOOP_DETECTED);
  });

  it("timeout budget <= 0 is rejected", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "treino",
      overrides: { timeout: 0 },
    });
    expect(ok).toBe(false);
    expect(plan.rejection_reason).toBe(ORCH_ERROR.TIMEOUT_BUDGET);
  });

  it("cost limit rejects expensive plans", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Estou cansado e quero treinar com volume alto",
      overrides: { maxCost: 1, maxSteps: 100 },
    });
    expect(ok).toBe(false);
    expect(plan.rejection_reason).toBe(ORCH_ERROR.COST_LIMIT);
  });

  it("insufficient context fallback without decision handoff", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: USER,
      intent: "Estou cansado e quero treinar",
      contextAvailable: false,
    });
    expect(ok).toBe(true);
    expect(plan.status).toBe("insufficient_context");
    expect(plan.skills).toContain("generate_daily_context");
    expect(plan.sequence.some((s) => s.ref === "decision_engine")).toBe(false);
    expect(plan.warnings?.some((w) => w.includes("insufficient_context"))).toBe(true);
  });

  it("anonymous is rejected", () => {
    const { ok, plan } = createExecutionPlan({
      trustedUserId: null,
      intent: "treino",
    });
    expect(ok).toBe(false);
    expect(plan.rejection_reason).toBe(ORCH_ERROR.ANONYMOUS_DENIED);
  });
});
