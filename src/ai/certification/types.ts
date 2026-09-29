/**
 * FASE 22.7 — Real Production Certification types.
 * UNTESTED ≠ PASS. Only EXECUTED + PASS satisfies a gate.
 */

export const CERT_STATUSES = [
  "PASS",
  "FAIL",
  "UNTESTED",
  "BLOCKED",
  "DEGRADED",
] as const;

export type CertStatus = (typeof CERT_STATUSES)[number];

/** Legacy aliases rejected as PASS. */
export const NON_PASS_ALIASES = [
  "UNTESTED",
  "SKIPPED",
  "UNKNOWN",
  "MOCKED",
  "pending",
  "na",
  "skip",
] as const;

export type CertEnvironment =
  | "local"
  | "LOCAL_TEST"
  | "ci"
  | "CI"
  | "STAGING"
  | "PRODUCTION"
  | "production-probe"
  | string;

export type CertCheck = {
  check_id: string;
  name: string;
  status: CertStatus;
  critical: boolean;
  /** ISO timestamp — required for PASS; null only when UNTESTED. */
  executed_at: string | null;
  duration_ms: number | null;
  evidence: Record<string, string | number | boolean | null>;
  error: string | null;
  environment: CertEnvironment;
};

export type CertTestSuiteResult = {
  /** True only after a real Vitest (or equivalent) run with exit 0. */
  executed: boolean;
  ok: boolean;
  passed: number | null;
  failed: number | null;
  duration_ms: number | null;
  command: string | null;
  error: string | null;
};

export type CriticalGates = {
  critical_safety: number;
  proposal_validity: number;
  tool_authorization: number;
};

export type CertificationReport = {
  report_version: string;
  timestamp: string;
  commit_sha: string;
  environment: CertEnvironment;
  production_ready: boolean;
  checks: CertCheck[];
  failures: string[];
  warnings: string[];
  evidence: Record<string, string | number | boolean | null>;
  test_suite: CertTestSuiteResult;
  gates: CriticalGates;
};

/**
 * Only EXECUTED + PASS satisfies a gate.
 * UNTESTED / SKIPPED / UNKNOWN / MOCKED / FAIL / BLOCKED / DEGRADED never pass.
 */
export function isExecutedPass(check: CertCheck | { status: string; executed_at?: string | null }): boolean {
  if (check.status !== "PASS") return false;
  if (check.executed_at == null || check.executed_at === "") return false;
  return true;
}

/** Normalize illegal PASS without execution → UNTESTED. */
export function normalizeCheck(check: CertCheck): CertCheck {
  if (check.status === "PASS" && (check.executed_at == null || check.executed_at === "")) {
    return {
      ...check,
      status: "UNTESTED",
      error: check.error ?? "PASS_without_execution_normalized_to_UNTESTED",
    };
  }
  return check;
}

export function untestedCheck(
  check_id: string,
  name: string,
  critical: boolean,
  environment: CertEnvironment = "local",
): CertCheck {
  return {
    check_id,
    name,
    status: "UNTESTED",
    critical,
    executed_at: null,
    duration_ms: null,
    evidence: {},
    error: null,
    environment,
  };
}
