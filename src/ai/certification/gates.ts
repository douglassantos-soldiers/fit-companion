/**
 * FASE 22.7 — Critical gates + production_ready evaluation.
 */
import {
  isExecutedPass,
  normalizeCheck,
  type CertCheck,
  type CertificationReport,
  type CertTestSuiteResult,
  type CriticalGates,
  type CertEnvironment,
} from "@/ai/certification/types";

const BLOCKING_CRITICAL = new Set(["FAIL", "UNTESTED", "BLOCKED", "DEGRADED"]);

export function gateRatio(requiredIds: string[], checks: CertCheck[]): number {
  if (requiredIds.length === 0) return 0;
  const byId = new Map(checks.map((c) => [c.check_id, c]));
  let pass = 0;
  for (const id of requiredIds) {
    const c = byId.get(id);
    if (c && isExecutedPass(c)) pass += 1;
  }
  return pass / requiredIds.length;
}

export function computeCriticalGates(checks: CertCheck[]): CriticalGates {
  return {
    critical_safety: gateRatio(["safety"], checks),
    proposal_validity: gateRatio(["decision_engine", "proposal_contract"], checks),
    tool_authorization: gateRatio(["authorization", "tools"], checks),
  };
}

export type EvaluateReadyInput = {
  checks: CertCheck[];
  test_suite: CertTestSuiteResult;
  timestamp?: string;
  commit_sha?: string;
  environment?: CertEnvironment;
  evidence?: Record<string, string | number | boolean | null>;
};

/**
 * production_ready = true only when:
 * - every critical check is EXECUTED+PASS
 * - no critical FAIL/UNTESTED/BLOCKED/DEGRADED
 * - test suite executed and ok
 * - critical gates all 100%
 */
export function evaluateProductionReady(input: EvaluateReadyInput): CertificationReport {
  const checks = input.checks.map(normalizeCheck);
  const gates = computeCriticalGates(checks);
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!input.test_suite.executed) {
    failures.push("test_suite:not_executed");
  } else if (!input.test_suite.ok) {
    failures.push(
      `test_suite:failed${input.test_suite.failed != null ? `:${input.test_suite.failed}` : ""}`,
    );
  }

  for (const c of checks) {
    if (!c.critical) {
      if (c.status === "FAIL") warnings.push(`${c.check_id}:FAIL`);
      if (c.status === "UNTESTED") warnings.push(`${c.check_id}:UNTESTED`);
      if (c.status === "BLOCKED") warnings.push(`${c.check_id}:BLOCKED`);
      continue;
    }
    if (!isExecutedPass(c)) {
      failures.push(`${c.check_id}:${c.status}${c.error ? `:${c.error}` : ""}`);
    }
    if (BLOCKING_CRITICAL.has(c.status)) {
      // already in failures via !isExecutedPass
    }
  }

  if (gates.critical_safety < 1) failures.push("gate:critical_safety<100%");
  if (gates.proposal_validity < 1) failures.push("gate:proposal_validity<100%");
  if (gates.tool_authorization < 1) failures.push("gate:tool_authorization<100%");

  // Dedupe
  const uniqFailures = [...new Set(failures)];

  const production_ready =
    uniqFailures.length === 0 &&
    input.test_suite.executed === true &&
    input.test_suite.ok === true &&
    gates.critical_safety === 1 &&
    gates.proposal_validity === 1 &&
    gates.tool_authorization === 1 &&
    checks.filter((c) => c.critical).every((c) => isExecutedPass(c));

  return {
    report_version: "fase22_7_v1",
    timestamp: input.timestamp ?? new Date().toISOString(),
    commit_sha: input.commit_sha ?? "unknown",
    environment: input.environment ?? "local",
    production_ready,
    checks,
    failures: uniqFailures,
    warnings: [...new Set(warnings)],
    evidence: input.evidence ?? {},
    test_suite: input.test_suite,
    gates,
  };
}
