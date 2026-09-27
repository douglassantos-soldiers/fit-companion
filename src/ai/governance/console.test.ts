/**
 * FASE 19 — Governance console helpers + metrics extensions.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAuditLog,
  recordAudit,
  listAudits,
  listAuditsByRunId,
  computeAiMetricsFromAudits,
  computeCostBreakdown,
  buildRunTraceTimeline,
  filterSafetyFeed,
  groupAgentStats,
  redactAuditForConsole,
  truncateUserId,
  diagnoseAgentRun,
} from "@/ai/governance";

beforeEach(() => {
  clearAuditLog();
});

describe("FASE 19 governance console helpers", () => {
  it("truncateUserId redacts PII shape", () => {
    expect(truncateUserId("user-abcdef12")).toMatch(/^user_\*{4}/);
  });

  it("redactAuditForConsole truncates user and keeps kind", () => {
    recordAudit({
      kind: "agent_run",
      user_id: "user-governance-aaaa",
      subject_id: "ar_1",
      run_id: "ar_1",
      agent_id: "specialist_training",
      status: "completed",
      metadata: { api_key: "sk-secret", provider: "mock" },
    });
    const a = listAudits(1)[0]!;
    const redacted = redactAuditForConsole(a);
    expect(String(redacted["user_id"])).toMatch(/^user_/);
    expect(redacted["kind"]).toBe("agent_run");
    const meta = redacted["metadata"] as Record<string, unknown> | undefined;
    expect(meta?.["api_key"]).toBe("[REDACTED]");
  });

  it("metrics include safety_rejection_rate and rag_failure_rate", () => {
    recordAudit({
      kind: "agent_run",
      user_id: "u1",
      subject_id: "a1",
      run_id: "a1",
      status: "blocked_by_safety",
    });
    recordAudit({
      kind: "agent_run",
      user_id: "u1",
      subject_id: "a2",
      run_id: "a2",
      status: "completed",
    });
    recordAudit({
      kind: "rag_retrieval",
      user_id: "u1",
      subject_id: "r1",
      retrieval_id: "r1",
      status: "error",
    });
    const m = computeAiMetricsFromAudits(listAudits(20));
    expect(m.safety_rejection_rate).toBeGreaterThan(0);
    expect(m.rag_failure_rate).toBeGreaterThan(0);
    expect(m.sample_size.safety_blocks).toBe(1);
  });

  it("cost breakdown groups by model/agent", () => {
    recordAudit({
      kind: "ai_gateway",
      user_id: "u1",
      subject_id: "g1",
      agent_id: "specialist_training",
      model: "mock-v1",
      estimated_cost: 0.02,
      token_usage: { input: 100, output: 50 },
      metadata: { provider: "mock" },
    });
    recordAudit({
      kind: "decision",
      user_id: "u1",
      subject_id: "d1",
      decision_id: "d1",
      status: "ok",
      estimated_cost: 0,
    });
    const b = computeCostBreakdown(listAudits(20));
    expect(b.total_estimated).toBeGreaterThan(0);
    expect(b.by_model.length).toBeGreaterThan(0);
    expect(b.by_agent.some((a) => a.agent_id === "specialist_training")).toBe(true);
  });

  it("filterSafetyFeed and groupAgentStats", () => {
    recordAudit({
      kind: "agent_run",
      user_id: "u1",
      subject_id: "a1",
      run_id: "a1",
      agent_id: "specialist_recovery",
      status: "blocked_by_safety",
      metadata: { error_code: "safety_rejection" },
    });
    recordAudit({
      kind: "tool_call",
      user_id: "u1",
      subject_id: "t1",
      tool_id: "secret_tool",
      status: "denied",
      metadata: { error_code: "unauthorized_tool" },
    });
    const audits = listAudits(20);
    expect(filterSafetyFeed(audits).length).toBeGreaterThanOrEqual(2);
    const stats = groupAgentStats(audits);
    expect(stats.find((s) => s.agent_id === "specialist_recovery")?.safety_blocked).toBe(1);
  });

  it("buildRunTraceTimeline from diagnoseAgentRun", () => {
    recordAudit({
      kind: "agent_run",
      user_id: "u1",
      subject_id: "ar_trace",
      run_id: "ar_trace",
      agent_id: "specialist_training",
      status: "completed",
      latency_ms: 12,
    });
    recordAudit({
      kind: "skill_run",
      user_id: "u1",
      subject_id: "sr1",
      run_id: "ar_trace",
      skill_id: "analyze_training",
      status: "completed",
    });
    const audits = listAuditsByRunId("ar_trace");
    const diag = diagnoseAgentRun("ar_trace", { extraAudits: audits });
    const timeline = buildRunTraceTimeline(diag, audits);
    expect(timeline.some((n) => n.stage === "Agent")).toBe(true);
    expect(timeline.some((n) => n.stage === "Decision")).toBe(true);
    expect(timeline.some((n) => n.stage === "Outcome")).toBe(true);
  });
});
