/**
 * FASE 22.7 — Meta-guarantee: UNTESTED never becomes PASS.
 */
import { describe, expect, it } from "vitest";
import {
  buildProductionReadinessReport,
  evaluateProductionReady,
  isExecutedPass,
  normalizeCheck,
} from "@/ai/certification";
import { untestedCheck, type CertCheck } from "@/ai/certification/types";

describe("FASE 22.7 certification integrity", () => {
  it("UNTESTED never satisfies isExecutedPass", () => {
    const u = untestedCheck("identity", "Identity", true);
    expect(isExecutedPass(u)).toBe(false);
    expect(isExecutedPass({ status: "SKIPPED", executed_at: null })).toBe(false);
    expect(isExecutedPass({ status: "UNKNOWN", executed_at: "2026-01-01" })).toBe(false);
    expect(isExecutedPass({ status: "MOCKED", executed_at: "2026-01-01" })).toBe(false);
    expect(isExecutedPass({ status: "FAIL", executed_at: "2026-01-01" })).toBe(false);
    expect(isExecutedPass({ status: "BLOCKED", executed_at: "2026-01-01" })).toBe(false);
    expect(isExecutedPass({ status: "DEGRADED", executed_at: "2026-01-01" })).toBe(false);
  });

  it("PASS without executed_at normalizes to UNTESTED", () => {
    const bad = normalizeCheck({
      check_id: "safety",
      name: "Safety",
      status: "PASS",
      critical: true,
      executed_at: null,
      duration_ms: null,
      evidence: {},
      error: null,
      environment: "local",
    });
    expect(bad.status).toBe("UNTESTED");
    expect(isExecutedPass(bad)).toBe(false);
  });

  it("PASS with executed_at is executed pass", () => {
    const ok: CertCheck = {
      check_id: "safety",
      name: "Safety",
      status: "PASS",
      critical: true,
      executed_at: new Date().toISOString(),
      duration_ms: 1,
      evidence: { ran: true },
      error: null,
      environment: "local",
    };
    expect(isExecutedPass(ok)).toBe(true);
  });

  it("builder without probes → production_ready false (defaults UNTESTED)", () => {
    const report = buildProductionReadinessReport();
    expect(report.production_ready).toBe(false);
    const untested = report.certification?.checks.filter((c) => c.status === "UNTESTED") ?? [];
    expect(untested.length).toBeGreaterThan(5);
  });

  it("test_suite.ok false → production_ready false even if all checks PASS", () => {
    const checks: CertCheck[] = [
      "identity",
      "authorization",
      "safety",
      "decision_engine",
      "proposal_contract",
      "tools",
      "rag",
      "memory",
      "llm",
      "audit",
      "database",
      "kill_switch",
      "rollback",
      "migrations",
      "e2e",
      "cost",
    ].map((id) => ({
      check_id: id,
      name: id,
      status: "PASS" as const,
      critical: true,
      executed_at: new Date().toISOString(),
      duration_ms: 1,
      evidence: {},
      error: null,
      environment: "local",
    }));
    const report = evaluateProductionReady({
      checks,
      test_suite: {
        executed: true,
        ok: false,
        passed: 0,
        failed: 3,
        duration_ms: 10,
        command: "vitest",
        error: "failed",
      },
    });
    expect(report.production_ready).toBe(false);
    expect(report.failures.some((f) => f.startsWith("test_suite"))).toBe(true);
  });

  it("test_suite_ok:true without execution rejected", () => {
    const report = buildProductionReadinessReport({ test_suite_ok: true });
    expect(report.production_ready).toBe(false);
    expect(report.certification?.test_suite.executed).toBe(false);
  });

  it("UNTESTED critical blocks readiness even with suite ok", () => {
    const checks: CertCheck[] = [
      {
        check_id: "safety",
        name: "Safety",
        status: "UNTESTED",
        critical: true,
        executed_at: null,
        duration_ms: null,
        evidence: {},
        error: null,
        environment: "local",
      },
    ];
    const report = evaluateProductionReady({
      checks,
      test_suite: {
        executed: true,
        ok: true,
        passed: 10,
        failed: 0,
        duration_ms: 1,
        command: "vitest",
        error: null,
      },
    });
    expect(report.production_ready).toBe(false);
    expect(report.failures.some((f) => f.includes("safety"))).toBe(true);
  });
});
