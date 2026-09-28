/**
 * FASE 22.13 — Final certification integrity (no remote secrets required).
 */
import { describe, expect, it } from "vitest";
import {
  buildComponentMatrix,
  partitionCheckLists,
  promoteFinalCritical,
  FINAL_REPORT_VERSION,
} from "@/ai/certification/final-types";
import { evaluateProductionReady } from "@/ai/certification/gates";
import { isExecutedPass, type CertCheck } from "@/ai/certification/types";
import { formatFinalCertificationMarkdown } from "@/ai/certification/format-final-report";
import type { FinalCertificationReport } from "@/ai/certification/final-types";
import { AI_PATH_LABEL } from "@/ai/runtime/path-labels";

function check(
  id: string,
  status: CertCheck["status"],
  critical = true,
): CertCheck {
  return {
    check_id: id,
    name: id,
    status,
    critical,
    executed_at: status === "UNTESTED" ? null : new Date().toISOString(),
    duration_ms: 1,
    evidence: { probe: true },
    error: status === "PASS" ? null : status.toLowerCase(),
    environment: "local",
  };
}

describe("FASE 22.13 final certification integrity", () => {
  it("UNTESTED never counts as PASS / production_ready", () => {
    const checks = promoteFinalCritical([
      check("safety", "PASS"),
      check("decision_engine", "PASS"),
      check("proposal_contract", "PASS"),
      check("authorization", "PASS"),
      check("tools", "PASS"),
      check("identity", "UNTESTED"),
    ]);
    const report = evaluateProductionReady({
      checks,
      test_suite: {
        executed: true,
        ok: true,
        passed: 1,
        failed: 0,
        duration_ms: 1,
        command: "x",
        error: null,
      },
    });
    expect(report.production_ready).toBe(false);
    expect(isExecutedPass(checks.find((c) => c.check_id === "identity")!)).toBe(false);
  });

  it("BLOCKED critical blocks production_ready", () => {
    const checks = [
      check("safety", "PASS"),
      check("decision_engine", "PASS"),
      check("proposal_contract", "PASS"),
      check("authorization", "PASS"),
      check("tools", "PASS"),
      check("database", "BLOCKED"),
    ];
    const report = evaluateProductionReady({
      checks,
      test_suite: {
        executed: true,
        ok: true,
        passed: 1,
        failed: 0,
        duration_ms: 1,
        command: "x",
        error: null,
      },
    });
    expect(report.production_ready).toBe(false);
    const { blocked_checks } = partitionCheckLists(checks);
    expect(blocked_checks).toContain("database");
  });

  it("promoteFinalCritical marks skills and rate_limit", () => {
    const out = promoteFinalCritical([
      check("skills", "PASS", false),
      check("rate_limit", "PASS", false),
    ]);
    expect(out.every((c) => c.critical)).toBe(true);
  });

  it("matrix marks missing checks as UNTESTED blocking", () => {
    const rows = buildComponentMatrix([check("safety", "PASS")]);
    const agents = rows.find((r) => r.check === "agents");
    expect(agents?.status).toBe("UNTESTED");
    expect(agents?.blocking).toBe(true);
  });

  it("formatter includes production_ready and matrix without inventing PASS", () => {
    const stub: FinalCertificationReport = {
      report_version: FINAL_REPORT_VERSION,
      timestamp: new Date().toISOString(),
      commit_sha: "abc",
      environment: "local",
      runtime_version: AI_PATH_LABEL.CANONICAL,
      governance_version: "governance_v1",
      contract_version: 1,
      production_ready: false,
      checks: [check("database", "BLOCKED")],
      components: buildComponentMatrix([check("database", "BLOCKED")]),
      failed_checks: [],
      blocked_checks: ["database"],
      untested_checks: [],
      warnings: [],
      failures: ["database:BLOCKED"],
      evidence: {},
      test_suite: {
        executed: true,
        ok: true,
        passed: 0,
        failed: 0,
        duration_ms: 1,
        command: "x",
        error: null,
      },
      gates: { critical_safety: 0, proposal_validity: 0, tool_authorization: 0 },
      side_artifacts: [],
      providers: "UNTESTED",
      migrations_status: "BLOCKED",
      rag_status: "DEGRADED",
      memory_status: "PASS",
      audit_status: "PASS",
      e2e_status: "BLOCKED",
      files_changed_note: "test",
      tests_executed: ["unit"],
    };
    const md = formatFinalCertificationMarkdown(stub);
    expect(md).toContain("production_ready: false");
    expect(md).toContain("BLOCKED");
    expect(md).not.toMatch(/production_ready: true/);
  });
});
