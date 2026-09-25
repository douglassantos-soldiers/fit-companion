/**
 * FASE 11 — persist serialize + best-effort dual-write.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuditLog,
  recordAudit,
  auditEventToRow,
  isPersistableUserId,
  rowToAuditEvent,
  diagnoseAgentRun,
  computeAiMetrics,
  AI_AUDIT_PERSIST_VERSION,
} from "@/ai/governance";
import { persistAiAuditEvent, setAiAuditPersistDbForTests } from "@/ai/governance/persist.server";

const UUID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  clearAuditLog();
  setAiAuditPersistDbForTests(null);
  process.env["AI_AUDIT_PERSIST"] = "0";
});

describe("serialize", () => {
  it("isPersistableUserId accepts uuid only", () => {
    expect(isPersistableUserId(UUID)).toBe(true);
    expect(isPersistableUserId("user-agent-aaaa")).toBe(false);
  });

  it("auditEventToRow skips non-uuid and redacts metadata", () => {
    expect(
      auditEventToRow({
        audit_id: "a1",
        kind: "agent_run",
        user_id: "not-uuid",
        created_at: "2026-09-25T12:00:00.000Z",
        subject_id: "ar_1",
        governance_version: "governance_v1",
        contract_version: 1,
      }),
    ).toBeNull();

    const row = auditEventToRow({
      audit_id: "a2",
      kind: "agent_run",
      user_id: UUID,
      created_at: "2026-09-25T12:00:00.000Z",
      subject_id: "ar_1",
      governance_version: "governance_v1",
      contract_version: 1,
      metadata: { api_key: "sk-secret", safe: "ok" },
    });
    expect(row).not.toBeNull();
    expect(row!.metadata?.["api_key"]).toBe("[REDACTED]");
    expect(row!.metadata?.["safe"]).toBe("ok");
    expect(rowToAuditEvent(row!).audit_id).toBe("a2");
  });

  it("exposes persist version constant", () => {
    expect(AI_AUDIT_PERSIST_VERSION).toBe("persist_v1");
  });
});

describe("persistAiAuditEvent fail-open", () => {
  it("skips when persist disabled", async () => {
    process.env["AI_AUDIT_PERSIST"] = "0";
    const r = await persistAiAuditEvent({
      audit_id: "a3",
      kind: "agent_run",
      user_id: UUID,
      created_at: "2026-09-25T12:00:00.000Z",
      subject_id: "ar",
      governance_version: "governance_v1",
      contract_version: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skipped).toBe(true);
  });

  it("upserts via mock db without throwing", async () => {
    process.env["AI_AUDIT_PERSIST"] = "1";
    const upsert = vi.fn().mockResolvedValue({ error: null });
    setAiAuditPersistDbForTests(async () => ({
      from: () => ({ upsert }),
    }));
    const r = await persistAiAuditEvent({
      audit_id: "a4",
      kind: "tool_call",
      user_id: UUID,
      created_at: "2026-09-25T12:00:00.000Z",
      subject_id: "tc_1",
      run_id: "ar_db",
      status: "completed",
      governance_version: "governance_v1",
      contract_version: 1,
    });
    expect(r.ok).toBe(true);
    expect(upsert).toHaveBeenCalled();
  });

  it("DB error returns ok:false but does not throw", async () => {
    process.env["AI_AUDIT_PERSIST"] = "1";
    setAiAuditPersistDbForTests(async () => ({
      from: () => ({
        upsert: async () => ({ error: { message: "boom" } }),
      }),
    }));
    const r = await persistAiAuditEvent({
      audit_id: "a5",
      kind: "agent_run",
      user_id: UUID,
      created_at: "2026-09-25T12:00:00.000Z",
      subject_id: "ar",
      governance_version: "governance_v1",
      contract_version: 1,
    });
    expect(r.ok).toBe(false);
  });
});

describe("diagnose + metrics with injected DB audits", () => {
  it("diagnoseAgentRun merges extraAudits and synthesizes run", () => {
    const diagnostic = diagnoseAgentRun("ar_from_db", {
      extraAudits: [
        {
          audit_id: "db1",
          kind: "agent_run",
          user_id: UUID,
          created_at: "2026-09-25T12:00:00.000Z",
          subject_id: "ar_from_db",
          run_id: "ar_from_db",
          agent_id: "specialist_training",
          agent_version: "1.0.0",
          status: "completed",
          context_fingerprint: "fp_db",
          model: "deterministic_runtime",
          estimated_cost: 2,
          latency_ms: 15,
          governance_version: "governance_v1",
          contract_version: 1,
        },
        {
          audit_id: "db2",
          kind: "decision",
          user_id: UUID,
          created_at: "2026-09-25T12:00:01.000Z",
          subject_id: "dec_1",
          run_id: "ar_from_db",
          decision_id: "dec_1",
          status: "ok",
          governance_version: "governance_v1",
          contract_version: 1,
        },
      ],
    });
    expect(diagnostic.answers).toHaveLength(12);
    expect(diagnostic.answers[0]?.value).toBe("specialist_training");
    expect(diagnostic.sections.context["context_fingerprint"]).toBe("fp_db");
  });

  it("computeAiMetrics source=db uses audits", () => {
    const metrics = computeAiMetrics({
      source: "db",
      audits: [
        {
          audit_id: "m1",
          kind: "agent_run",
          user_id: UUID,
          created_at: "2026-09-25T12:00:00.000Z",
          subject_id: "ar",
          run_id: "ar",
          status: "completed",
          latency_ms: 10,
          estimated_cost: 1,
          governance_version: "governance_v1",
          contract_version: 1,
        },
        {
          audit_id: "m2",
          kind: "tool_call",
          user_id: UUID,
          created_at: "2026-09-25T12:00:01.000Z",
          subject_id: "tc",
          run_id: "ar",
          status: "failed",
          governance_version: "governance_v1",
          contract_version: 1,
        },
      ],
    });
    expect(metrics.agent_success_rate).toBe(1);
    expect(metrics.tool_error_rate).toBe(1);
    expect(metrics.estimated_cost).toBe(1);
  });

  it("recordAudit with persist disabled does not throw", () => {
    process.env["AI_AUDIT_PERSIST"] = "0";
    expect(() =>
      recordAudit({
        kind: "agent_run",
        user_id: UUID,
        subject_id: "x",
        status: "completed",
      }),
    ).not.toThrow();
  });
});
