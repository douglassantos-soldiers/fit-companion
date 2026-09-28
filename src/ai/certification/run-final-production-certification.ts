/**
 * FASE 22.13 — Final Production Certification runner.
 * AUDIT / VERIFY / TEST / CERTIFY only — no product features.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  runProductionCertification,
  resolveCommitSha,
  type RunProductionCertificationOpts,
} from "@/ai/certification/run-production-certification";
import { evaluateProductionReady } from "@/ai/certification/gates";
import { runFinalSupplementalProbes } from "@/ai/certification/probes/final-probes";
import { formatFinalCertificationMarkdown } from "@/ai/certification/format-final-report";
import { verifyAiDatabaseReadiness } from "@/ai/certification/verify-database-readiness.server";
import { verifyAiRateLimitReadiness } from "@/ai/certification/verify-rate-limit-readiness.server";
import { verifyKillSwitchReadiness } from "@/ai/certification/verify-kill-switch-readiness.server";
import { verifyProductionE2EReadiness } from "@/ai/certification/verify-production-e2e-readiness.server";
import {
  AI_GOVERNANCE_CONTRACT_VERSION,
  AI_GOVERNANCE_VERSION,
} from "@/ai/governance/version";
import { AI_PATH_LABEL } from "@/ai/runtime/path-labels";
import type { CertCheck, CertEnvironment } from "@/ai/certification/types";
import {
  FINAL_REPORT_VERSION,
  buildComponentMatrix,
  partitionCheckLists,
  promoteFinalCritical,
  statusFromCheck,
  type FinalCertificationReport,
  type FinalSideArtifact,
} from "@/ai/certification/final-types";

export type RunFinalProductionCertificationOpts = RunProductionCertificationOpts & {
  /** Skip supplemental probes (runtime/agents/eval/ci) — tests only. */
  skipSupplemental?: boolean;
  /** Skip re-running side readiness verifies. */
  skipSideArtifacts?: boolean;
};

function resolveEnvironment(override?: CertEnvironment): CertEnvironment {
  if (override) return override;
  if (process.env["CI"] === "true" || process.env["CI"] === "1") return "ci";
  return "local";
}

function evidenceSnippet(c: CertCheck | undefined): string {
  if (!c) return "UNTESTED";
  const keys = Object.keys(c.evidence);
  if (!keys.length) return c.status;
  return `${c.status}:{${keys.slice(0, 4).join(",")}}`;
}

export function persistFinalCertificationReport(report: FinalCertificationReport): {
  jsonPath: string;
  mdPath: string;
  historyPath: string;
} {
  const certDir = join(process.cwd(), "docs", "certification");
  mkdirSync(certDir, { recursive: true });
  const historyDir = join(certDir, "history");
  mkdirSync(historyDir, { recursive: true });

  const jsonPath = join(certDir, "final.json");
  const stamp = report.timestamp.replace(/[:.]/g, "-");
  const historyPath = join(historyDir, `final-${stamp}.json`);
  const payload = JSON.stringify(report, null, 2);
  writeFileSync(jsonPath, payload, "utf8");
  writeFileSync(historyPath, payload, "utf8");

  const mdPath = join(process.cwd(), "docs", "AI_PRODUCTION_CERTIFICATION_FINAL.md");
  writeFileSync(mdPath, formatFinalCertificationMarkdown(report), "utf8");

  return { jsonPath, mdPath, historyPath };
}

/**
 * Final certification entrypoint.
 */
export async function runFinalProductionCertification(
  opts?: RunFinalProductionCertificationOpts,
): Promise<{
  report: FinalCertificationReport;
  markdown: string;
  persisted?: { jsonPath: string; mdPath: string; historyPath: string };
}> {
  const environment = resolveEnvironment(opts?.environment);
  const timestamp = new Date().toISOString();
  const commit_sha = await resolveCommitSha();

  // 1) Base FASE 22.7 certification (suite + probes → latest.json)
  const base = await runProductionCertification({
    skipTestSuite: opts?.skipTestSuite,
    skipPersist: opts?.skipPersist,
    environment,
  });

  // 2) Side readiness artifacts (fresh persist)
  const side_artifacts: FinalSideArtifact[] = [];
  if (!opts?.skipSideArtifacts) {
    const db = await verifyAiDatabaseReadiness({
      persistPath: join(process.cwd(), "docs", "certification", "database-readiness.json"),
    });
    side_artifacts.push({
      id: "database-readiness",
      path: "docs/certification/database-readiness.json",
      verdict: db.verdict,
      error_code: db.error_code ?? null,
    });

    const rl = await verifyAiRateLimitReadiness({
      persistPath: join(process.cwd(), "docs", "certification", "rate-limit-readiness.json"),
    });
    side_artifacts.push({
      id: "rate-limit-readiness",
      path: "docs/certification/rate-limit-readiness.json",
      verdict: rl.verdict,
      error_code: rl.error_code ?? null,
    });

    const ks = await verifyKillSwitchReadiness({
      persistPath: join(process.cwd(), "docs", "certification", "kill-switch-readiness.json"),
    });
    side_artifacts.push({
      id: "kill-switch-readiness",
      path: "docs/certification/kill-switch-readiness.json",
      verdict: ks.verdict,
      error_code: ks.error_code ?? null,
    });

    const e2e = await verifyProductionE2EReadiness({
      mode: "full",
      persistPath: join(process.cwd(), "docs", "certification", "production-e2e.json"),
    });
    side_artifacts.push({
      id: "production-e2e",
      path: "docs/certification/production-e2e.json",
      verdict: e2e.verdict,
      error_code: e2e.error_code ?? null,
    });
  }

  // 3) Supplemental probes (after latest.json exists for ci_cd)
  let supplemental: CertCheck[] = [];
  if (!opts?.skipSupplemental) {
    supplemental = await runFinalSupplementalProbes({ environment });
  }

  // 4) Merge + promote skills/rate_limit critical for FINAL envelope
  const merged = promoteFinalCritical([...base.report.checks, ...supplemental]);

  const evaluated = evaluateProductionReady({
    checks: merged,
    test_suite: base.report.test_suite,
    timestamp,
    commit_sha,
    environment,
    evidence: {
      ...base.report.evidence,
      final_report_version: FINAL_REPORT_VERSION,
      supplemental_count: supplemental.length,
      side_artifact_count: side_artifacts.length,
    },
  });

  // Override report_version for final envelope semantics (evaluate uses fase22_7)
  const { failed_checks, blocked_checks, untested_checks } = partitionCheckLists(
    evaluated.checks,
  );
  const components = buildComponentMatrix(evaluated.checks);

  const rag = evaluated.checks.find((c) => c.check_id === "rag");
  const mem = evaluated.checks.find((c) => c.check_id === "memory");
  const audit = evaluated.checks.find((c) => c.check_id === "audit");
  const e2e = evaluated.checks.find((c) => c.check_id === "e2e");
  const llm = evaluated.checks.find((c) => c.check_id === "llm");
  const migrations = evaluated.checks.find((c) => c.check_id === "migrations");
  const database = evaluated.checks.find((c) => c.check_id === "database");

  const report: FinalCertificationReport = {
    report_version: FINAL_REPORT_VERSION,
    timestamp,
    commit_sha,
    environment,
    runtime_version: AI_PATH_LABEL.CANONICAL,
    governance_version: AI_GOVERNANCE_VERSION,
    contract_version: AI_GOVERNANCE_CONTRACT_VERSION,
    production_ready: evaluated.production_ready,
    checks: evaluated.checks,
    components,
    failed_checks,
    blocked_checks,
    untested_checks,
    warnings: evaluated.warnings,
    failures: evaluated.failures,
    evidence: {
      ...evaluated.evidence,
      project_id: "47f1291e-fde8-441f-8f56-5f389fe16da0",
    },
    test_suite: evaluated.test_suite,
    gates: evaluated.gates,
    side_artifacts,
    providers: evidenceSnippet(llm),
    migrations_status: `migrations=${statusFromCheck(evaluated.checks, "migrations")}; database=${statusFromCheck(evaluated.checks, "database")}; side=${
      side_artifacts.find((s) => s.id === "database-readiness")?.verdict ?? "n/a"
    }`,
    rag_status: evidenceSnippet(rag),
    memory_status: evidenceSnippet(mem),
    audit_status: evidenceSnippet(audit),
    e2e_status: evidenceSnippet(e2e),
    files_changed_note:
      "FASE 22.13 certification aggregator only — see final.json / this markdown; no product feature commits implied",
    tests_executed: [
      "certification vitest suite (security/data/failure/runtime/integrity)",
      "runAllProbes (FASE 22.7)",
      "verifyAiDatabaseReadiness / rate-limit / kill-switch / production-e2e",
      "final probes: canonical_runtime, agents, evaluation, ci_cd",
      ...(opts?.skipTestSuite ? ["(cert suite skipped by caller)"] : []),
    ],
  };

  void database;
  void migrations;

  const markdown = formatFinalCertificationMarkdown(report);
  let persisted: { jsonPath: string; mdPath: string; historyPath: string } | undefined;
  if (!opts?.skipPersist) {
    persisted = persistFinalCertificationReport(report);
  }

  return { report, markdown, ...(persisted ? { persisted } : {}) };
}
