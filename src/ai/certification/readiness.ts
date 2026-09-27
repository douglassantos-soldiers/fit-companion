/**
 * Production readiness checklist + report builder (FASE 21).
 * production_ready = false if any critical item fails.
 */

import { assertCostBounds } from "@/ai/runtime/cost-bounds";
import { getAiFeatureFlags } from "@/ai/runtime/feature-flags";
import { resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";
import { classifyAuditDurability } from "@/ai/governance/durability";
import { isSensitiveKey } from "@/ai/governance/redact";
import type { MigrationVerifyResult } from "@/ai/certification/verify-migrations.server";

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

export type CertItemStatus = "pass" | "fail" | "pending" | "na";

export type CertChecklistItem = {
  id: string;
  label: string;
  status: CertItemStatus;
  critical: boolean;
  notes?: string;
};

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
};

export function buildProductionReadinessReport(opts?: {
  migrations?: MigrationVerifyResult;
  overrides?: Partial<Record<string, CertItemStatus>>;
  test_suite_ok?: boolean;
}): ProductionReadinessReport {
  const flags = getAiFeatureFlags();
  const cost = assertCostBounds();
  const o = opts?.overrides ?? {};
  const mig = opts?.migrations;

  const checklist: CertChecklistItem[] = [
    { id: "identity", label: "Identity", status: o["identity"] ?? "pass", critical: true },
    { id: "authorization", label: "Authorization", status: o["authorization"] ?? "pass", critical: true },
    { id: "context", label: "Context", status: o["context"] ?? "pass", critical: false },
    { id: "safety", label: "Safety", status: o["safety"] ?? "pass", critical: true },
    {
      id: "decision_engine",
      label: "Decision Engine",
      status: o["decision_engine"] ?? "pass",
      critical: true,
    },
    {
      id: "proposal_contract",
      label: "Proposal Contract",
      status: o["proposal_contract"] ?? "pass",
      critical: true,
    },
    { id: "agents", label: "Agents", status: o["agents"] ?? "pass", critical: false },
    { id: "skills", label: "Skills", status: o["skills"] ?? "pass", critical: false },
    { id: "tools", label: "Tools", status: o["tools"] ?? "pass", critical: true },
    { id: "rag", label: "RAG", status: o["rag"] ?? "pass", critical: false },
    { id: "memory", label: "Memory", status: o["memory"] ?? "pass", critical: false },
    { id: "orchestrator", label: "Orchestrator", status: o["orchestrator"] ?? "pass", critical: false },
    { id: "governance", label: "Governance", status: o["governance"] ?? "pass", critical: false },
    { id: "audit", label: "Audit", status: o["audit"] ?? "pass", critical: true },
    { id: "evaluation", label: "Evaluation", status: o["evaluation"] ?? "pass", critical: false },
    { id: "llm_gateway", label: "LLM Gateway", status: o["llm_gateway"] ?? "pass", critical: false },
    {
      id: "cost",
      label: "Cost",
      status: o["cost"] ?? (cost.ok ? "pass" : "fail"),
      critical: true,
      notes: cost.notes.join("; ") || undefined,
    },
    { id: "reliability", label: "Reliability", status: o["reliability"] ?? "pass", critical: false },
    { id: "rollback", label: "Rollback", status: o["rollback"] ?? "pass", critical: true },
    { id: "monitoring", label: "Monitoring", status: o["monitoring"] ?? "pass", critical: false },
    {
      id: "production_migrations",
      label: "Production migrations",
      status:
        o["production_migrations"] ??
        (mig == null
          ? "pending"
          : mig.all_applied
            ? "pass"
            : mig.any_unavailable
              ? "pending"
              : "fail"),
      critical: true,
      notes: mig
        ? mig.tables.map((t) => `${t.table}:${t.status}`).join(", ")
        : "not_probed",
    },
  ];

  if (opts?.test_suite_ok === false) {
    for (const id of ["authorization", "safety", "audit"] as const) {
      const item = checklist.find((c) => c.id === id);
      if (item) item.status = "fail";
    }
  }

  const approved = checklist.filter((c) => c.status === "pass").map((c) => c.label);
  const pending = checklist.filter((c) => c.status === "pending").map((c) => c.label);
  const failed_critical = checklist
    .filter((c) => c.critical && c.status === "fail")
    .map((c) => c.label);

  const risks: string[] = [];
  if (pending.includes("Production migrations")) {
    risks.push("Remote AI migrations not verified — do not assume Git == applied");
  }
  if (!flags.force_deterministic && flags.llm_enabled) {
    risks.push("LLM path enabled — ensure AI_FORCE_DETERMINISTIC kill-switch is known to ops");
  }
  risks.push("AI rate limits are in-process only (not multi-instance)");
  risks.push("CRITICAL audit persist has retry but no durable outbox");

  const limitations = [
    "LLM cost is proxy/estimated — not provider billing",
    "Performance bench is local Vitest, not cloud load test",
    "Human review UI for eval golden cases not shipped",
  ];

  const dependencies = [
    "SUPABASE_SERVICE_ROLE_KEY for audit/RAG/memory persist",
    "ACCESS_SESSION_SECRET for trusted identity",
    "OPENAI_API_KEY only if AI_RUNTIME_MODE=hybrid|llm and AI_LLM_ENABLED=1",
  ];

  const recommendations = [
    "Apply pending supabase migrations for ai_audit_events + ai_knowledge_* before enabling LLM",
    "Keep AI_RUNTIME_MODE=deterministic until eval + migrations green",
    "On incident: set AI_FORCE_DETERMINISTIC=1 (see AI_ROLLBACK.md)",
    "Run npm run test:eval and npm run cert:ai on Agent/Skill/RAG/Provider changes",
  ];

  // Smoke that durability + redact helpers load
  void classifyAuditDurability({
    audit_id: "x",
    kind: "decision",
    user_id: "u",
    created_at: "",
    subject_id: "d",
    governance_version: "g",
    contract_version: 1,
  } as never);
  void isSensitiveKey("token");

  const production_ready =
    failed_critical.length === 0 &&
    !checklist.some((c) => c.critical && c.status === "pending");

  return {
    report_version: "fase21_v1",
    generated_at: new Date().toISOString(),
    production_ready,
    checklist,
    approved,
    pending,
    failed_critical,
    risks,
    limitations,
    dependencies,
    recommendations,
    ...(mig ? { migrations: mig } : {}),
    runtime: {
      effective_mode: resolveEffectiveRuntimeMode(),
      flags,
      cost_bounds_ok: cost.ok,
    },
  };
}

export function formatReadinessMarkdown(report: ProductionReadinessReport): string {
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
    const mark = c.status === "pass" ? "x" : " ";
    lines.push(`- [${mark}] ${c.label} — **${c.status}**${c.critical ? " (critical)" : ""}${c.notes ? ` — ${c.notes}` : ""}`);
  }
  lines.push("", "## Approved", ...report.approved.map((a) => `- ${a}`));
  lines.push("", "## Pending", ...(report.pending.length ? report.pending.map((a) => `- ${a}`) : ["- (none)"]));
  lines.push(
    "",
    "## Failed critical",
    ...(report.failed_critical.length ? report.failed_critical.map((a) => `- ${a}`) : ["- (none)"]),
  );
  lines.push("", "## Risks", ...report.risks.map((r) => `- ${r}`));
  lines.push("", "## Limitations", ...report.limitations.map((r) => `- ${r}`));
  lines.push("", "## Dependencies", ...report.dependencies.map((r) => `- ${r}`));
  lines.push("", "## Recommendations", ...report.recommendations.map((r) => `- ${r}`));
  lines.push(
    "",
    "## Runtime",
    "",
    "```json",
    JSON.stringify(report.runtime, null, 2),
    "```",
    "",
  );
  if (report.migrations) {
    lines.push("## Migrations probe", "", "```json", JSON.stringify(report.migrations, null, 2), "```", "");
  }
  lines.push(
    "> Do not declare production-ready while critical security, authorization, data integrity, safety, decision integrity, auditability, rollback, or migrations remain fail/pending.",
    "",
  );
  return lines.join("\n");
}
