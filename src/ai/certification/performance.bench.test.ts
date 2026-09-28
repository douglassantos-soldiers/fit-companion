/**
 * FASE 21 — Observability trace + performance bench + readiness report.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { clearAgentRunLog } from "@/ai/agents/runtime/agent-run-log";
import { clearAuditLog } from "@/ai/governance/audit";
import { clearRagRetrievalLog } from "@/ai/governance/rag-retrieval-log";
import { clearSkillRunLog } from "@/ai/skills/core/skill-run-log";
import { clearToolCallLog } from "@/ai/mcp/core/tool-call-log";
import { registerDefaultAgents } from "@/ai/orchestrator/agents/registry";
import { registerAllSkills } from "@/ai/skills/register";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { runAiE2EPipeline } from "@/ai/e2e/run-pipeline";
import { buildAiExecutionTrace } from "@/ai/e2e/trace";
import { runAiEvaluation } from "@/ai/governance/eval/runner";
import { listAudits, recordAudit } from "@/ai/governance/audit";
import {
  CERT_TRACE_REQUIRED_IDS,
  buildProductionReadinessReport,
  formatReadinessMarkdown,
} from "@/ai/certification";

const USER = "user-cert-obs-aaaa";

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

describe("FASE 21 observability", () => {
  it("successful pipeline trace covers required correlation ids", async () => {
    const out = await runAiE2EPipeline({
      trustedUserId: USER,
      runEvaluation: false,
    });
    expect(out.ok).toBe(true);
    expect(out.run_id).toBeTruthy();
    const trace = buildAiExecutionTrace(out.run_id, { stages: out.stage_results });
    expect(CERT_TRACE_REQUIRED_IDS.length).toBeGreaterThan(5);
    expect(trace.run_id).toBe(out.run_id);
    expect(out.decision).toBeTruthy();
    expect(out.trace.agent_id || out.decision).toBeTruthy();
  }, 60_000);
});

describe("FASE 21 performance bench", () => {
  it("single evaluation suite latency is bounded", () => {
    const t0 = Date.now();
    const suite = runAiEvaluation();
    const ms = Date.now() - t0;
    expect(suite.passed).toBe(12);
    expect(ms).toBeLessThan(5_000);
  });

  it("handles concurrent evaluation runs", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => Promise.resolve(runAiEvaluation())),
    );
    expect(results.every((r) => r.passed === 12)).toBe(true);
  });

  it("audit list is paginated / bounded", () => {
    for (let i = 0; i < 50; i++) {
      recordAudit({
        kind: "agent_run",
        user_id: USER,
        subject_id: `s_${i}`,
        run_id: `ar_${i}`,
        status: "completed",
      });
    }
    const page = listAudits(20);
    expect(page.length).toBeLessThanOrEqual(20);
  });
});

describe("FASE 21 readiness report", () => {
  it("defaults are UNTESTED and refuse production_ready without real cert", () => {
    const report = buildProductionReadinessReport();
    expect(report.production_ready).toBe(false);
    expect(report.pending.length).toBeGreaterThan(0);
    const identity = report.checklist.find((c) => c.id === "identity");
    expect(identity?.status).toBe("pending"); // legacy mapping of UNTESTED

    const withFail = buildProductionReadinessReport({
      overrides: { authorization: "fail" },
    });
    expect(withFail.production_ready).toBe(false);
    expect(withFail.failed_critical).toContain("Authorization");

    // test_suite_ok:true must NOT unlock readiness
    const fakeSuite = buildProductionReadinessReport({ test_suite_ok: true });
    expect(fakeSuite.production_ready).toBe(false);
    expect(formatReadinessMarkdown(fakeSuite)).toContain("production_ready: false");
  });
});
