/**
 * Governance unit tests — redact, audit, metrics, correlation.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { clearAgentRunLog, recordAgentRun } from "@/ai/agents/runtime/agent-run-log";
import { clearSkillRunLog, recordSkillRun } from "@/ai/skills/core/skill-run-log";
import { clearToolCallLog, recordToolCall } from "@/ai/mcp/core/tool-call-log";
import {
  clearAuditLog,
  clearRagRetrievalLog,
  computeAiMetrics,
  diagnoseAgentRun,
  listAudits,
  recordDecisionAudit,
  recordOutcomeAudit,
  recordRagRetrieval,
  redactForAudit,
  AI_GOVERNANCE_VERSION,
} from "@/ai/governance";

beforeEach(() => {
  clearAgentRunLog();
  clearSkillRunLog();
  clearToolCallLog();
  clearAuditLog();
  clearRagRetrievalLog();
});

describe("redactForAudit", () => {
  it("redacts api keys and service_role", () => {
    const out = redactForAudit({
      api_key: "sk-secret",
      service_role: "sr-xxx",
      access_token: "tok",
      safe: "ok",
    }) as Record<string, unknown>;
    expect(out["api_key"]).toBe("[REDACTED]");
    expect(out["service_role"]).toBe("[REDACTED]");
    expect(out["access_token"]).toBe("[REDACTED]");
    expect(out["safe"]).toBe("ok");
  });
});

describe("audit + metrics", () => {
  it("mirrors agent/skill/tool into audit log", () => {
    recordAgentRun({
      run_id: "ar_1",
      agent_id: "specialist_training",
      user_id: "user_1",
      status: "completed",
      created_at: "2026-09-25T12:00:00.000Z",
      metadata: { agent_version: "1.0.0", latency_ms: 40, estimated_cost: 2 },
    });
    recordSkillRun({
      skill_run_id: "sr_1",
      skill_id: "analyze_performance",
      run_id: "ar_1",
      agent_id: "specialist_training",
      user_id: "user_1",
      status: "completed",
      created_at: "2026-09-25T12:00:00.000Z",
      latency_ms: 12,
    });
    recordToolCall({
      tool_call_id: "tc_1",
      tool: "get_training_context",
      tool_id: "get_training_context",
      run_id: "ar_1",
      agent_id: "specialist_training",
      user_id: "user_1",
      status: "failed",
      created_at: "2026-09-25T12:00:00.000Z",
      latency_ms: 5,
      error_code: "tool_failed",
    });
    recordRagRetrieval(
      {
        retrieval_id: "kr_1",
        query: "volume",
        mode: "hybrid",
        hits: [
          {
            chunk_id: "c1",
            document_id: "d1",
            domain: "exercise",
            score: 0.8,
            semantic_score: 0.8,
            keyword_score: 0.5,
            title: "t",
            excerpt: "e",
            source_id: "src_1",
          },
        ],
        latency_ms: 8,
        created_at: "2026-09-25T12:00:00.000Z",
      },
      { userId: "user_1", runId: "ar_1", agentId: "specialist_training" },
    );
    recordDecisionAudit({
      userId: "user_1",
      decisionId: "dec_1",
      runId: "ar_1",
      status: "ok",
    });
    recordOutcomeAudit({
      userId: "user_1",
      outcomeId: "out_1",
      decisionId: "dec_1",
      runId: "ar_1",
      quality: "success",
      adherence: 0.9,
    });

    const audits = listAudits(100);
    expect(audits.some((a) => a.kind === "agent_run")).toBe(true);
    expect(audits.some((a) => a.kind === "skill_run")).toBe(true);
    expect(audits.some((a) => a.kind === "tool_call")).toBe(true);
    expect(audits.some((a) => a.kind === "rag_retrieval")).toBe(true);
    expect(audits.every((a) => a.governance_version === AI_GOVERNANCE_VERSION)).toBe(true);

    const m = computeAiMetrics();
    expect(m.agent_success_rate).toBe(1);
    expect(m.tool_error_rate).toBe(1);
    expect(m.rag_hit_rate).toBe(1);
    expect(m.retrieval_relevance).toBeGreaterThan(0);
    expect(m.decision_success_rate).toBe(1);
    expect(m.action_adherence).toBe(0.9);
    expect(m.outcome_quality).toBe(1);
    expect(m.estimated_cost).toBeGreaterThan(0);
  });

  it("diagnoseAgentRun answers known fields without secrets", () => {
    recordAgentRun({
      run_id: "ar_diag",
      agent_id: "specialist_training",
      user_id: "user_1",
      status: "completed",
      created_at: "2026-09-25T12:00:00.000Z",
      context_fingerprint: "fp_1",
      skill_run_ids: ["sr_x"],
      tool_call_ids: ["tc_x"],
      decision_ids: ["dec_x"],
      metadata: {
        agent_version: "1.0.0",
        model: "deterministic_runtime",
        estimated_cost: 3,
        latency_ms: 25,
        retrieval_ids: "kr_diag",
        api_key: "should_not_leak",
      },
    });
    recordSkillRun({
      skill_run_id: "sr_x",
      skill_id: "analyze_performance",
      run_id: "ar_diag",
      agent_id: "specialist_training",
      user_id: "user_1",
      status: "completed",
      created_at: "2026-09-25T12:00:00.000Z",
    });
    recordToolCall({
      tool_call_id: "tc_x",
      tool: "get_training_context",
      tool_id: "get_training_context",
      run_id: "ar_diag",
      agent_id: "specialist_training",
      user_id: "user_1",
      status: "completed",
      created_at: "2026-09-25T12:00:00.000Z",
    });
    recordRagRetrieval(
      {
        retrieval_id: "kr_diag",
        query: "q",
        mode: "hybrid",
        hits: [
          {
            chunk_id: "c",
            document_id: "doc",
            domain: "exercise",
            score: 0.7,
            semantic_score: 0.7,
            keyword_score: 0.2,
            title: "Doc",
            excerpt: "ex",
            source_id: "src",
          },
        ],
        latency_ms: 3,
        created_at: "2026-09-25T12:00:00.000Z",
      },
      { runId: "ar_diag", userId: "user_1" },
    );
    recordDecisionAudit({
      userId: "user_1",
      decisionId: "dec_x",
      runId: "ar_diag",
      status: "ok",
    });

    const diag = diagnoseAgentRun("ar_diag");
    expect(diag.answers).toHaveLength(12);
    expect(diag.answers.every((a) => a.question.length > 0)).toBe(true);
    expect(diag.answers[0]?.status).toBe("known");
    const blob = JSON.stringify(diag);
    expect(blob).not.toMatch(/should_not_leak/);
    expect(blob).not.toMatch(/sk-secret/);
  });
});
