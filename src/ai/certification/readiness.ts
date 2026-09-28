/**
 * Production readiness checklist + report builder.
 * FASE 21 legacy surface adapted for FASE 22.7 — defaults are UNTESTED, never PASS.
 */

import { assertCostBounds } from "@/ai/runtime/cost-bounds";
import { getAiFeatureFlags } from "@/ai/runtime/feature-flags";
import { resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";
import type { MigrationVerifyResult } from "@/ai/certification/verify-migrations.server";
import {
  evaluateProductionReady,
  type EvaluateReadyInput,
} from "@/ai/certification/gates";
import {
  isExecutedPass,
  normalizeCheck,
  untestedCheck,
  type CertCheck,
  type CertStatus,
  type CertificationReport,
} from "@/ai/certification/types";
import { formatCertificationMarkdown } from "@/ai/certification/format-report";

export const CERT_SECURITY_CHECKS = [
  "wrong_user",
  "wrong_resource",
  "unauthorized_tool",
  "privilege_escalation",
  "direct_endpoint",
  "audit_redaction",
] as const;

export const CERT_TRACE_REQUIRED_IDS = [
  "run_id",
  "agent",
  "skill",
  "tool",
  "retrieval",
  "proposal",
  "decision",
  "outcome",
  "learning",
] as const;

/** @deprecated Use CertStatus (PASS|FAIL|UNTESTED|BLOCKED|DEGRADED). */
export type CertItemStatus = "pass" | "fail" | "pending" | "na" | CertStatus;

export type CertChecklistItem = {
  id: string;
  label: string;
  status: CertItemStatus;
  critical: boolean;
  notes?: string;
};

/** Legacy report shape kept for older callers; prefer CertificationReport. */
export type ProductionReadinessReport = {
  report_version: string;
  generated_at: string;
  production_ready: boolean;
  checklist: CertChecklistItem[];
  approved: string[];
  pending: string[];
  failed_critical: string[];
  risks: string[];
  limitations: string[];
  dependencies: string[];
  recommendations: string[];
  migrations?: MigrationVerifyResult;
  runtime: {
    effective_mode: string;
    flags: ReturnType<typeof getAiFeatureFlags>;
    cost_bounds_ok: boolean;
  };
  /** FASE 22.7 optional full report */
  certification?: CertificationReport;
};

const CHECK_META: Array<{ id: string; label: string; critical: boolean }> = [
  { id: "identity", label: "Identity", critical: true },
  { id: "authorization", label: "Authorization", critical: true },
  { id: "context", label: "Context", critical: false },
  { id: "safety", label: "Safety", critical: true },
  { id: "decision_engine", label: "Decision Engine", critical: true },
  { id: "proposal_contract", label: "Proposal Contract", critical: true },
  { id: "tools", label: "Tools", critical: true },
  { id: "skills", label: "Skills", critical: false },
  { id: "rag", label: "RAG", critical: true },
  { id: "memory", label: "Memory", critical: true },
  { id: "llm", label: "LLM Gateway", critical: true },
  { id: "audit", label: "Audit", critical: true },
  { id: "database", label: "Database", critical: true },
  { id: "rate_limit", label: "Rate Limit", critical: false },
  { id: "kill_switch", label: "Kill Switch", critical: true },
  { id: "rollback", label: "Rollback", critical: true },
  { id: "migrations", label: "Migrations", critical: true },
  { id: "e2e", label: "E2E Bridge", critical: true },
  { id: "cost", label: "Cost", critical: true },
];

function legacyToStatus(s: CertItemStatus | undefined): CertStatus | undefined {
  if (s == null) return undefined;
  if (s === "pass") return "PASS";
  if (s === "fail") return "FAIL";
  if (s === "pending" || s === "na") return "UNTESTED";
  return s;
}

function statusToLegacy(s: CertStatus): CertItemStatus {
  if (s === "PASS") return "pass";
  if (s === "FAIL") return "fail";
  if (s === "UNTESTED") return "pending";
  if (s === "BLOCKED" || s === "DEGRADED") return "pending";
  return "pending";
}

/**
 * Build report. Defaults are UNTESTED — never PASS by omission.
 * Prefer runProductionCertification() for real probes.
 */
export function buildProductionReadinessReport(opts?: {
  migrations?: MigrationVerifyResult;
  overrides?: Partial<Record<string, CertItemStatus>>;
  /** @deprecated Ignored when true without suite execution — cannot invent PASS. */
  test_suite_ok?: boolean;
  checks?: CertCheck[];
  commit_sha?: string;
  environment?: string;
}): ProductionReadinessReport {
  const flags = getAiFeatureFlags();
  const cost = assertCostBounds();
  const o = opts?.overrides ?? {};

  const checks: CertCheck[] =
    opts?.checks?.map(normalizeCheck) ??
    CHECK_META.map((m) => {
      const override = legacyToStatus(o[m.id]);
      if (override === "PASS") {
        // Explicit override to PASS without executed_at is illegal → UNTESTED
        return normalizeCheck({
          ...untestedCheck(m.id, m.label, m.critical),
          status: "PASS",
          executed_at: null,
        });
      }
      if (override) {
        return normalizeCheck({
          check_id: m.id,
          name: m.label,
          status: override,
          critical: m.critical,
          executed_at: override === "UNTESTED" ? null : new Date().toISOString(),
          duration_ms: override === "UNTESTED" ? null : 0,
          evidence: { source: "override" },
          error: null,
          environment: opts?.environment ?? "local",
        });
      }
      return untestedCheck(m.id, m.label, m.critical, opts?.environment ?? "local");
    });

  // Cost can be evaluated locally without remote
  if (!opts?.checks && !o["cost"]) {
    const costCheck = normalizeCheck({
      check_id: "cost",
      name: "Cost",
      status: cost.ok ? "PASS" : "FAIL",
      critical: true,
      executed_at: new Date().toISOString(),
      duration_ms: 0,
      evidence: { cost_bounds_ok: cost.ok },
      error: cost.ok ? null : cost.notes.join("; "),
      environment: opts?.environment ?? "local",
    });
    const idx = checks.findIndex((c) => c.check_id === "cost");
    if (idx >= 0) checks[idx] = costCheck;
  }

  if (opts?.migrations && !opts?.checks) {
    const mig = opts.migrations;
    const status: CertStatus = mig.all_applied
      ? "PASS"
      : mig.any_unavailable
        ? "BLOCKED"
        : "FAIL";
    const migCheck = normalizeCheck({
      check_id: "migrations",
      name: "Migrations",
      status,
      critical: true,
      executed_at: new Date().toISOString(),
      duration_ms: 0,
      evidence: {
        all_applied: mig.all_applied,
        detail: mig.tables.map((t) => `${t.table}:${t.status}`).join(","),
      },
      error: mig.all_applied ? null : "migrations_incomplete",
      environment: opts?.environment ?? "local",
    });
    const idx = checks.findIndex((c) => c.check_id === "migrations");
    if (idx >= 0) checks[idx] = migCheck;
    const dbIdx = checks.findIndex((c) => c.check_id === "database");
    if (dbIdx >= 0) checks[dbIdx] = { ...migCheck, check_id: "database", name: "Database" };
  }

  // test_suite_ok:true without execution must NOT unlock readiness
  const test_suite: EvaluateReadyInput["test_suite"] =
    opts?.test_suite_ok === true
      ? {
          executed: false,
          ok: false,
          passed: null,
          failed: null,
          duration_ms: null,
          command: null,
          error: "test_suite_ok_true_without_execution_rejected",
        }
      : opts?.test_suite_ok === false
        ? {
            executed: true,
            ok: false,
            passed: 0,
            failed: 1,
            duration_ms: 0,
            command: "legacy",
            error: "test_suite_ok_false",
          }
        : {
            executed: false,
            ok: false,
            passed: null,
            failed: null,
            duration_ms: null,
            command: null,
            error: "suite_not_run",
          };

  const certification = evaluateProductionReady({
    checks,
    test_suite,
    commit_sha: opts?.commit_sha ?? "unknown",
    environment: opts?.environment ?? "local",
  });

  const checklist: CertChecklistItem[] = checks.map((c) => ({
    id: c.check_id,
    label: c.name,
    status: statusToLegacy(c.status),
    critical: c.critical,
    notes: c.error ?? undefined,
  }));

  const approved = checks.filter((c) => isExecutedPass(c)).map((c) => c.name);
  const pending = checks
    .filter((c) => c.status === "UNTESTED" || c.status === "BLOCKED" || c.status === "DEGRADED")
    .map((c) => c.name);
  const failed_critical = checks
    .filter((c) => c.critical && c.status === "FAIL")
    .map((c) => c.name);

  const risks = [
    "FASE 22.7: UNTESTED/BLOCKED/DEGRADED block production_ready — never treat as PASS",
    "CRITICAL audit: awaited persist + retry; no distributed outbox (FASE 22.6)",
    "AI rate limits use distributed Supabase store when service_role available (FASE 22.10); BLOCKED without remote RPC",
  ];
  if (!flags.force_deterministic && flags.llm_enabled) {
    risks.push("LLM path enabled — ensure AI_FORCE_DETERMINISTIC kill-switch is known to ops");
  }

  return {
    report_version: certification.report_version,
    generated_at: certification.timestamp,
    production_ready: certification.production_ready,
    checklist,
    approved,
    pending,
    failed_critical,
    risks,
    limitations: [
      "LLM cost is proxy/estimated — not provider billing",
      "Use npm run ai:certification for real probes + suite",
    ],
    dependencies: [
      "SUPABASE_SERVICE_ROLE_KEY for audit/RAG/memory persist",
      "ACCESS_SESSION_SECRET for trusted identity",
    ],
    recommendations: [
      "Run npm run ai:certification before enabling hybrid/llm",
      "On incident: set AI_FORCE_DETERMINISTIC=1 (see AI_ROLLBACK.md)",
    ],
    ...(opts?.migrations ? { migrations: opts.migrations } : {}),
    runtime: {
      effective_mode: resolveEffectiveRuntimeMode(),
      flags,
      cost_bounds_ok: cost.ok,
    },
    certification,
  };
}

export function formatReadinessMarkdown(report: ProductionReadinessReport): string {
  if (report.certification) {
    return formatCertificationMarkdown(report.certification);
  }
  const lines: string[] = [
    "# AI Production Readiness Report",
    "",
    `Generated: ${report.generated_at}`,
    `Report version: ${report.report_version}`,
    `**production_ready: ${report.production_ready}**`,
    "",
    "## Checklist",
    "",
  ];
  for (const c of report.checklist) {
    const mark = c.status === "pass" || c.status === "PASS" ? "x" : " ";
    lines.push(
      `- [${mark}] ${c.label} — **${c.status}**${c.critical ? " (critical)" : ""}${c.notes ? ` — ${c.notes}` : ""}`,
    );
  }
  lines.push(
    "",
    "> UNTESTED ≠ PASS. Do not declare production-ready without npm run ai:certification.",
    "",
  );
  return lines.join("\n");
}

export { isExecutedPass, normalizeCheck } from "@/ai/certification/types";
export type { CertCheck, CertStatus, CertificationReport } from "@/ai/certification/types";
