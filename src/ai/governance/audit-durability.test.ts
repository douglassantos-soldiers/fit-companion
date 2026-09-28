/**
 * FASE 22.6 — Durable Critical AI Audit tests.
 * Decision → Audit → DB → Read back; restart; DB fail; idempotency; redact.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearAuditLog,
  listAudits,
  recordCriticalAudit,
  redactSummary,
  stableCriticalAuditId,
  classifyAuditDurability,
} from "@/ai/governance";
import {
  loadAuditById,
  persistCriticalAiAudit,
  setAiAuditPersistDbForTests,
  AUDIT_PERSISTENCE_FAILED,
} from "@/ai/governance/persist.server";
import { AI_GOVERNANCE_CONTRACT_VERSION, AI_GOVERNANCE_VERSION } from "@/ai/governance/version";
import type { AiAuditEvent } from "@/ai/governance/audit";

const UUID = "11111111-1111-4111-8111-111111111111";

type Row = Record<string, unknown>;

function createMemoryDb() {
  const store = new Map<string, Row>();
  let failNext = 0;
  let unavailable = false;

  const api = {
    store,
    setFailNext(n: number) {
      failNext = n;
    },
    setUnavailable(v: boolean) {
      unavailable = v;
    },
    getDb: async () => {
      if (unavailable) return null;
      return {
        from: (_t: string) => ({
          upsert: async (row: Row) => {
            if (failNext > 0) {
              failNext -= 1;
              return { error: { message: "transient timeout" } };
            }
            store.set(String(row["audit_id"]), { ...row });
            return { error: null };
          },
          select: (_cols: string) => {
            const chain = {
              eq: (col: string, val: string) => {
                if (col === "audit_id") {
                  return {
                    maybeSingle: async () => {
                      const row = store.get(val) ?? null;
                      return { data: row, error: null };
                    },
                    or: () => chain,
                    order: () => ({
                      data: [...store.values()],
                      error: null,
                    }),
                  };
                }
                return {
                  or: () => ({
                    order: async () => ({ data: [...store.values()], error: null }),
                  }),
                  order: async () => ({ data: [...store.values()], error: null }),
                  limit: async () => ({ data: [...store.values()], error: null }),
                  gte: () => ({
                    order: async () => ({ data: [...store.values()], error: null }),
                  }),
                };
              },
              order: async () => ({ data: [...store.values()], error: null }),
            };
            return chain;
          },
        }),
      };
    },
  };
  return api;
}

function decisionEvent(overrides?: Partial<AiAuditEvent>): AiAuditEvent {
  const decisionId = overrides?.decision_id ?? "dec_durable_1";
  return {
    audit_id: overrides?.audit_id ?? stableCriticalAuditId("decision", decisionId),
    kind: "decision",
    user_id: UUID,
    created_at: "2026-09-27T12:00:00.000Z",
    subject_id: decisionId,
    decision_id: decisionId,
    run_id: overrides?.run_id ?? "run_durable_1",
    status: "resolved",
    summary: overrides?.summary ?? "engine:FULL_WORKOUT",
    context_fingerprint: "fp_test",
    governance_version: AI_GOVERNANCE_VERSION,
    contract_version: AI_GOVERNANCE_CONTRACT_VERSION,
    metadata: overrides?.metadata,
    ...overrides,
  };
}

beforeEach(() => {
  clearAuditLog();
  setAiAuditPersistDbForTests(null);
  process.env["AI_AUDIT_PERSIST"] = "0";
});

afterEach(() => {
  setAiAuditPersistDbForTests(null);
  process.env["AI_AUDIT_PERSIST"] = "0";
});

describe("classifyAuditDurability FASE 22.6", () => {
  it("marks decision/outcome/learning as critical", () => {
    expect(classifyAuditDurability(decisionEvent())).toBe("critical");
    expect(
      classifyAuditDurability({
        ...decisionEvent(),
        kind: "outcome",
        audit_id: "a_out",
        subject_id: "o1",
        outcome_id: "o1",
      }),
    ).toBe("critical");
    expect(
      classifyAuditDurability({
        ...decisionEvent(),
        kind: "learning_event",
        audit_id: "a_le",
        subject_id: "le1",
        learning_event_id: "le1",
      }),
    ).toBe("critical");
  });

  it("marks rag_retrieval used_for_decision as critical", () => {
    expect(
      classifyAuditDurability({
        ...decisionEvent({ kind: "rag_retrieval", audit_id: "a_rag", subject_id: "r1" }),
        kind: "rag_retrieval",
        decision_id: undefined,
        metadata: { used_for_decision: true },
      }),
    ).toBe("critical");
  });

  it("marks observational gateway ok", () => {
    expect(
      classifyAuditDurability({
        ...decisionEvent(),
        kind: "ai_gateway",
        audit_id: "a_gw",
        subject_id: "gw",
        status: "ok",
        decision_id: undefined,
      }),
    ).toBe("observational");
  });
});

describe("persistCriticalAiAudit durability", () => {
  it("Decision → Audit → DB → Read back", async () => {
    process.env["AI_AUDIT_PERSIST"] = "1";
    const mem = createMemoryDb();
    setAiAuditPersistDbForTests(mem.getDb);

    const event = decisionEvent();
    const r = await persistCriticalAiAudit(event);
    expect(r.ok).toBe(true);
    expect(r.persisted).toBe(true);
    expect(r.audit_id).toBe(event.audit_id);

    const back = await loadAuditById(event.audit_id);
    expect(back).not.toBeNull();
    expect(back!.decision_id).toBe(event.decision_id);
    expect(back!.run_id).toBe(event.run_id);
    expect(back!.kind).toBe("decision");
  });

  it("restart: ring clear, DB still has event", async () => {
    process.env["AI_AUDIT_PERSIST"] = "1";
    const mem = createMemoryDb();
    setAiAuditPersistDbForTests(mem.getDb);

    const recorded = await recordCriticalAudit({
      kind: "decision",
      audit_id: stableCriticalAuditId("decision", "dec_restart"),
      user_id: UUID,
      subject_id: "dec_restart",
      decision_id: "dec_restart",
      run_id: "run_restart",
      status: "resolved",
    });
    expect(recorded.persisted).toBe(true);
    expect(listAudits().some((a) => a.audit_id === recorded.audit_id)).toBe(true);

    clearAuditLog();
    expect(listAudits()).toHaveLength(0);

    const back = await loadAuditById(recorded.audit_id);
    expect(back?.decision_id).toBe("dec_restart");
    expect(back?.run_id).toBe("run_restart");
  });

  it("DB unavailable → AUDIT_PERSISTENCE_FAILED explícito", async () => {
    process.env["AI_AUDIT_PERSIST"] = "1";
    const mem = createMemoryDb();
    mem.setUnavailable(true);
    setAiAuditPersistDbForTests(mem.getDb);

    const r = await persistCriticalAiAudit(decisionEvent());
    expect(r.ok).toBe(false);
    expect(r.persisted).toBe(false);
    if (!r.ok) {
      expect(r.error_code).toBe(AUDIT_PERSISTENCE_FAILED);
      expect(r.error).toContain("admin_db_unavailable");
    }
  });

  it("retries transient errors then succeeds", async () => {
    process.env["AI_AUDIT_PERSIST"] = "1";
    const mem = createMemoryDb();
    mem.setFailNext(2);
    setAiAuditPersistDbForTests(mem.getDb);

    const event = decisionEvent({ audit_id: "audit_decision_retry" });
    const r = await persistCriticalAiAudit(event);
    expect(r.ok).toBe(true);
    expect(r.persisted).toBe(true);
    expect(mem.store.has(event.audit_id)).toBe(true);
  });

  it("idempotent double persist same audit_id", async () => {
    process.env["AI_AUDIT_PERSIST"] = "1";
    const mem = createMemoryDb();
    setAiAuditPersistDbForTests(mem.getDb);

    const event = decisionEvent({ audit_id: "audit_decision_idem" });
    const r1 = await persistCriticalAiAudit(event);
    const r2 = await persistCriticalAiAudit({ ...event, summary: "engine:updated" });
    expect(r1.persisted).toBe(true);
    expect(r2.persisted).toBe(true);
    expect(mem.store.size).toBe(1);
    expect(mem.store.get(event.audit_id)?.["summary"]).toBe("engine:updated");
  });

  it("secrets redacted in persisted row", async () => {
    process.env["AI_AUDIT_PERSIST"] = "1";
    const mem = createMemoryDb();
    setAiAuditPersistDbForTests(mem.getDb);

    const recorded = await recordCriticalAudit({
      kind: "decision",
      audit_id: stableCriticalAuditId("decision", "dec_secret"),
      user_id: UUID,
      subject_id: "dec_secret",
      decision_id: "dec_secret",
      summary: "Bearer sk-live-ABCDEFGH1234 leaked",
      metadata: {
        api_key: "sk-secret-value",
        access_token: "tok",
        service_role: "sr-key",
        safe: "ok",
      },
    });
    expect(recorded.persisted).toBe(true);
    expect(recorded.event.metadata?.["api_key"]).toBe("[REDACTED]");
    expect(recorded.event.metadata?.["access_token"]).toBe("[REDACTED]");
    expect(recorded.event.metadata?.["service_role"]).toBe("[REDACTED]");
    expect(recorded.event.metadata?.["safe"]).toBe("ok");
    expect(recorded.event.summary).not.toContain("sk-live");
    expect(recorded.event.summary).toContain("[REDACTED]");

    const row = mem.store.get(recorded.audit_id);
    expect(row).toBeTruthy();
    const meta = row!["metadata"] as Record<string, unknown>;
    expect(meta["api_key"]).toBe("[REDACTED]");
  });
});

describe("redactSummary", () => {
  it("redacts bearer and sk tokens", () => {
    expect(redactSummary("Authorization Bearer abc.def.ghi")).toContain("[REDACTED]");
    expect(redactSummary("key sk-abcdefghijklmnop")).toContain("[REDACTED]");
  });
});

describe("bridge Decision gate", () => {
  it("surfaces AUDIT_PERSISTENCE_FAILED when DB down with persist on", async () => {
    process.env["AI_AUDIT_PERSIST"] = "1";
    setAiAuditPersistDbForTests(async () => null);

    const { assembleDecisionContext } = await import("@/lib/engine/assemble-decision-context");
    const { buildQaScenario } = await import("@/lib/qa/scenarios");
    const { buildProposalId } = await import("@/lib/engine/decision-proposal");
    const { runAuthoritativeBridge } = await import("@/ai/runtime/authoritative-bridge");

    const date = "2026-03-11";
    const state = { ...buildQaScenario("healthy_full", { date }), userId: UUID };
    const snap = assembleDecisionContext(state, { date, userId: UUID, source: "offline_legacy" });
    expect(snap).toBeTruthy();
    const mode = snap!.decisions.trainingMode;
    const proposed_type =
      mode === "rest"
        ? "REST"
        : mode === "deload"
          ? "DELOAD"
          : mode === "express"
            ? "EXPRESS_WORKOUT"
            : "FULL_WORKOUT";
    const created_at = new Date().toISOString();
    const proposal = {
      proposal_id: buildProposalId({
        userId: UUID,
        proposedType: proposed_type,
        proposedValue: mode,
        createdAt: created_at,
      }),
      user_id: UUID,
      context_id: snap!.inputFingerprint,
      proposed_type,
      proposed_value: mode,
      reason_codes: ["progression_ready" as const],
      confidence: 0.8,
      source: "coach" as const,
      created_at,
    };

    const bridge = await runAuthoritativeBridge({
      proposal,
      snapshot: snap!,
      runId: "run_audit_fail",
      emitOutcomeAndLearning: false,
    });

    expect(bridge.ok).toBe(false);
    expect(bridge.error_code).toBe("AUDIT_PERSISTENCE_FAILED");
    expect(bridge.audit_persisted).toBe(false);
    expect(bridge.decision).toBeTruthy();
  });

  it("completes when persist disabled (harness skip)", async () => {
    process.env["AI_AUDIT_PERSIST"] = "0";
    const { assembleDecisionContext } = await import("@/lib/engine/assemble-decision-context");
    const { buildQaScenario } = await import("@/lib/qa/scenarios");
    const { buildProposalId } = await import("@/lib/engine/decision-proposal");
    const { runAuthoritativeBridge } = await import("@/ai/runtime/authoritative-bridge");

    const date = "2026-03-12";
    const state = { ...buildQaScenario("healthy_full", { date }), userId: UUID };
    const snap = assembleDecisionContext(state, { date, userId: UUID, source: "offline_legacy" });
    const mode = snap!.decisions.trainingMode;
    const proposed_type =
      mode === "rest"
        ? "REST"
        : mode === "deload"
          ? "DELOAD"
          : mode === "express"
            ? "EXPRESS_WORKOUT"
            : "FULL_WORKOUT";
    const created_at = new Date().toISOString();
    const proposal = {
      proposal_id: buildProposalId({
        userId: UUID,
        proposedType: proposed_type,
        proposedValue: mode,
        createdAt: created_at,
      }),
      user_id: UUID,
      context_id: snap!.inputFingerprint,
      proposed_type,
      proposed_value: mode,
      reason_codes: ["progression_ready" as const],
      confidence: 0.8,
      source: "coach" as const,
      created_at,
    };

    const bridge = await runAuthoritativeBridge({
      proposal,
      snapshot: snap!,
      runId: "run_audit_skip",
      emitOutcomeAndLearning: false,
    });

    expect(bridge.ok).toBe(true);
    expect(bridge.audit_id).toMatch(/^audit_decision_/);
    expect(bridge.audit_persisted).toBe(false);
  });
});
