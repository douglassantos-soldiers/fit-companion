/**
 * MCP Tool Layer — security and pipeline tests.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearToolCallLog,
  clearToolRegistry,
  defineReadTool,
  hashInput,
  invokeTool,
  listReadTools,
  listWriteTools,
  redactInput,
  registerAllMcpTools,
  registerTool,
  TOOL_ERROR,
} from "@/ai/mcp";
import type { DomainContextLoader, RegisteredTool } from "@/ai/mcp/core/types";
import { emptyState, type AppState } from "@/lib/types";

const USER_A = "user-aaaa-aaaa";
const USER_B = "user-bbbb-bbbb";

const fixtureLoader: DomainContextLoader = async (userId, date) => {
  const state: AppState = {
    ...emptyState,
    userId,
    profile: {
      name: "QA",
      goal: "massa",
      level: "intermediario",
      daysPerWeek: 4,
      age: 28,
      heightCm: 178,
      weightKg: 80,
      equipment: "academia",
      restrictions: [],
      createdAt: new Date().toISOString(),
      typicalSleepHours: 7,
      timezone: "America/Sao_Paulo",
    },
    sessions: [
      {
        id: "sess-1",
        dayId: "a",
        title: "Treino A",
        date: date ?? "2026-03-11",
        durationMin: 45,
        exercises: [],
        volumeKg: 1000,
        rpe: "ok",
      },
    ],
    purchaseProductIds: ["whey-protein"],
  };
  return {
    userId,
    date: date ?? "2026-03-11",
    state,
    performanceContext: null,
  };
};

beforeEach(() => {
  clearToolCallLog();
  clearToolRegistry();
  registerAllMcpTools({ force: true });
});

describe("MCP Tool Layer", () => {
  it("registers READ and WRITE catalogs", () => {
    expect(listReadTools().length).toBeGreaterThanOrEqual(13);
    expect(listWriteTools().length).toBeGreaterThanOrEqual(1);
    expect(listReadTools().every((t) => t.classification === "read")).toBe(true);
    expect(listWriteTools().every((t) => t.classification === "write")).toBe(true);
    const requiredRead = [
      "get_user_profile",
      "get_user_goal",
      "get_current_plan",
      "get_training_history",
      "get_training_session",
      "get_nutrition",
      "get_sleep",
      "get_recovery",
      "get_wearable_data",
      "get_recent_decisions",
      "get_recent_outcomes",
      "get_orders",
      "get_products",
    ];
    const ids = new Set(listReadTools().map((t) => t.id));
    for (const id of requiredRead) {
      expect(ids.has(id)).toBe(true);
    }
    expect(requiredRead).toHaveLength(13);
  });

  it("anonymous access is denied", async () => {
    const res = await invokeTool({
      toolId: "get_products",
      trustedUserId: null,
      input: {},
      loader: fixtureLoader,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe("denied");
    expect(res.error_code).toBe(TOOL_ERROR.ANONYMOUS_DENIED);
    expect(res.tool_call.error_code).toBe(TOOL_ERROR.ANONYMOUS_DENIED);
  });

  it("authenticated access succeeds on READ", async () => {
    const res = await invokeTool({
      toolId: "get_products",
      trustedUserId: USER_A,
      input: { limit: 5 },
      loader: fixtureLoader,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe("completed");
    expect(res.data).toBeDefined();
    const data = res.data as { products: unknown[] };
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.products.length).toBeGreaterThan(0);
    expect(res.tool_call.user_id).toBe(USER_A);
    expect(res.tool_call.input_hash).toMatch(/^h_/);
    expect(typeof res.tool_call.latency_ms).toBe("number");
  });

  it("user A cannot target user B", async () => {
    const res = await invokeTool({
      toolId: "get_user_profile",
      trustedUserId: USER_A,
      targetUserId: USER_B,
      input: {},
      loader: fixtureLoader,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe("denied");
    expect(res.error_code).toBe(TOOL_ERROR.FORGED_USER);
  });

  it("invalid input fails closed", async () => {
    const res = await invokeTool({
      toolId: "get_training_session",
      trustedUserId: USER_A,
      input: {}, // missing sessionId
      loader: fixtureLoader,
    });
    expect(res.ok).toBe(false);
    expect(res.error_code).toBe(TOOL_ERROR.INVALID_INPUT);
  });

  it("unauthorized / unknown tool is denied", async () => {
    const res = await invokeTool({
      toolId: "get_secret_admin_db",
      trustedUserId: USER_A,
      input: {},
      loader: fixtureLoader,
    });
    expect(res.ok).toBe(false);
    expect(res.error_code).toBe(TOOL_ERROR.UNAUTHORIZED_TOOL);
  });

  it("malformed output is rejected", async () => {
    const bad: RegisteredTool = {
      id: "test_bad_output",
      name: "test_bad_output",
      version: "1",
      access: "read",
      classification: "read",
      permission: "test",
      authorization: "authenticated",
      input_schema: { type: "object", additionalProperties: false, properties: {} },
      output_schema: { type: "object", required: ["ok"] },
      requires_safety_gate: false,
      requires_decision_authority: false,
      handler: () => "not-an-object",
    };
    registerTool(bad);
    const res = await invokeTool({
      toolId: "test_bad_output",
      trustedUserId: USER_A,
      input: {},
      loader: fixtureLoader,
    });
    expect(res.ok).toBe(false);
    expect(res.error_code).toBe(TOOL_ERROR.MALFORMED_OUTPUT);
  });

  it("timeout fails with timeout code", async () => {
    defineReadTool({
      id: "test_slow_tool",
      name: "test_slow_tool",
      description: "slow",
      permission: "test",
      input_schema: { type: "object", additionalProperties: false, properties: {} },
      output_schema: { type: "object" },
      handler: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return { ok: true };
      },
    });
    const res = await invokeTool({
      toolId: "test_slow_tool",
      trustedUserId: USER_A,
      input: {},
      timeoutMs: 30,
      loader: fixtureLoader,
    });
    expect(res.ok).toBe(false);
    expect(res.error_code).toBe(TOOL_ERROR.TIMEOUT);
  });

  it("WRITE tool validates then denies write_not_enabled", async () => {
    const invalid = await invokeTool({
      toolId: "propose_training_adjustment",
      trustedUserId: USER_A,
      input: {},
      loader: fixtureLoader,
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.error_code).toBe(TOOL_ERROR.INVALID_INPUT);

    const denied = await invokeTool({
      toolId: "propose_training_adjustment",
      trustedUserId: USER_A,
      input: { proposed_type: "REDUCE_VOLUME" },
      loader: fixtureLoader,
    });
    expect(denied.ok).toBe(false);
    expect(denied.status).toBe("denied");
    expect(denied.error_code).toBe(TOOL_ERROR.WRITE_NOT_ENABLED);
  });

  it("training history and session scoped to fixture user", async () => {
    const hist = await invokeTool({
      toolId: "get_training_history",
      trustedUserId: USER_A,
      input: { limit: 5 },
      loader: fixtureLoader,
    });
    expect(hist.ok).toBe(true);
    const sessions = (hist.data as { sessions: Array<{ id: string }> }).sessions;
    expect(sessions[0]?.id).toBe("sess-1");

    const one = await invokeTool({
      toolId: "get_training_session",
      trustedUserId: USER_A,
      input: { sessionId: "sess-1" },
      loader: fixtureLoader,
    });
    expect(one.ok).toBe(true);
    expect((one.data as { session: { id: string } | null }).session?.id).toBe("sess-1");
  });

  it("ToolCall redacts secrets and keeps input_hash", async () => {
    const redacted = redactInput({ token: "super-secret", limit: 3 });
    expect(redacted["token"]).toBe("[redacted]");
    expect(redacted["limit"]).toBe(3);
    expect(hashInput({ token: "a" })).toBe(hashInput({ token: "b" })); // same after redact

    const res = await invokeTool({
      toolId: "get_products",
      trustedUserId: USER_A,
      input: { limit: 2, token: "should-not-store" },
      loader: fixtureLoader,
    });
    // additionalProperties false → invalid_input for unknown token OR if allowed, must redact
    if (res.ok) {
      expect(res.tool_call.args_summary?.["token"]).toBe("[redacted]");
    } else {
      expect(res.error_code).toBe(TOOL_ERROR.INVALID_INPUT);
      expect(res.tool_call.input_hash || res.error_code).toBeTruthy();
    }
  });
});
