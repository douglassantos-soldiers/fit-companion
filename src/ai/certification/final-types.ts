/**
 * FASE 22.13 — Final Production Certification types.
 * UNTESTED/BLOCKED/DEGRADED ≠ PASS. No score. No invented evidence.
 */
import type { CertCheck, CertEnvironment, CertStatus, CertTestSuiteResult, CriticalGates } from "@/ai/certification/types";
import { isExecutedPass } from "@/ai/certification/types";

export const FINAL_REPORT_VERSION = "fase22_13_v1" as const;

export type FinalComponentRow = {
  component: string;
  check: string;
  status: CertStatus;
  evidence: string;
  timestamp: string | null;
  error: string | null;
  environment: CertEnvironment;
  critical: boolean;
  blocking: boolean;
};

export type FinalSideArtifact = {
  id: string;
  path: string;
  verdict: string;
  error_code?: string | null;
};

export type FinalCertificationReport = {
  report_version: typeof FINAL_REPORT_VERSION;
  timestamp: string;
  commit_sha: string;
  environment: CertEnvironment;
  runtime_version: string;
  governance_version: string;
  contract_version: number;
  production_ready: boolean;
  checks: CertCheck[];
  components: FinalComponentRow[];
  failed_checks: string[];
  blocked_checks: string[];
  untested_checks: string[];
  warnings: string[];
  failures: string[];
  evidence: Record<string, string | number | boolean | null>;
  test_suite: CertTestSuiteResult;
  gates: CriticalGates;
  side_artifacts: FinalSideArtifact[];
  providers: string;
  migrations_status: string;
  rag_status: string;
  memory_status: string;
  audit_status: string;
  e2e_status: string;
  files_changed_note: string;
  tests_executed: string[];
};

/** Domain → check_id mapping for the FINAL matrix (16 axes). */
export const FINAL_DOMAIN_CHECKS: ReadonlyArray<{
  component: string;
  check_ids: readonly string[];
}> = [
  { component: "runtime", check_ids: ["canonical_runtime", "kill_switch", "rollback"] },
  { component: "decision", check_ids: ["decision_engine", "proposal_contract", "safety"] },
  { component: "security", check_ids: ["identity", "authorization", "tools"] },
  { component: "agents", check_ids: ["agents"] },
  { component: "skills", check_ids: ["skills"] },
  { component: "tools", check_ids: ["tools"] },
  { component: "rag", check_ids: ["rag"] },
  { component: "memory", check_ids: ["memory"] },
  { component: "llm", check_ids: ["llm", "cost"] },
  { component: "audit", check_ids: ["audit"] },
  { component: "evaluation", check_ids: ["evaluation"] },
  { component: "ci_cd", check_ids: ["ci_cd"] },
  { component: "database", check_ids: ["database", "migrations"] },
  { component: "rate_limiting", check_ids: ["rate_limit"] },
  { component: "kill_switch", check_ids: ["kill_switch"] },
  { component: "e2e", check_ids: ["e2e"] },
];

/** Checks promoted to critical only in the FINAL envelope. */
export const FINAL_PROMOTE_CRITICAL = new Set(["skills", "rate_limit"]);

export function promoteFinalCritical(checks: CertCheck[]): CertCheck[] {
  return checks.map((c) =>
    FINAL_PROMOTE_CRITICAL.has(c.check_id) ? { ...c, critical: true } : c,
  );
}

export function buildComponentMatrix(checks: CertCheck[]): FinalComponentRow[] {
  const byId = new Map(checks.map((c) => [c.check_id, c]));
  const rows: FinalComponentRow[] = [];
  for (const domain of FINAL_DOMAIN_CHECKS) {
    for (const id of domain.check_ids) {
      const c = byId.get(id);
      if (!c) {
        rows.push({
          component: domain.component,
          check: id,
          status: "UNTESTED",
          evidence: "",
          timestamp: null,
          error: "check_missing_from_run",
          environment: "local",
          critical: true,
          blocking: true,
        });
        continue;
      }
      const blocking = c.critical && !isExecutedPass(c);
      rows.push({
        component: domain.component,
        check: c.check_id,
        status: c.status,
        evidence: JSON.stringify(c.evidence),
        timestamp: c.executed_at,
        error: c.error,
        environment: c.environment,
        critical: c.critical,
        blocking,
      });
    }
  }
  return rows;
}

export function partitionCheckLists(checks: CertCheck[]): {
  failed_checks: string[];
  blocked_checks: string[];
  untested_checks: string[];
} {
  const failed_checks: string[] = [];
  const blocked_checks: string[] = [];
  const untested_checks: string[] = [];
  for (const c of checks) {
    if (c.status === "FAIL") failed_checks.push(c.check_id);
    else if (c.status === "BLOCKED" || c.status === "DEGRADED") blocked_checks.push(c.check_id);
    else if (c.status === "UNTESTED") untested_checks.push(c.check_id);
  }
  return { failed_checks, blocked_checks, untested_checks };
}

export function statusFromCheck(checks: CertCheck[], id: string): string {
  const c = checks.find((x) => x.check_id === id);
  if (!c) return "UNTESTED";
  return c.error ? `${c.status}:${c.error}` : c.status;
}
