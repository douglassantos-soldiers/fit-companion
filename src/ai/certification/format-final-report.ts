/**
 * FASE 22.13 — Format FinalCertificationReport → AI_PRODUCTION_CERTIFICATION_FINAL.md
 */
import type { FinalCertificationReport } from "@/ai/certification/final-types";

export function formatFinalCertificationMarkdown(report: FinalCertificationReport): string {
  const lines: string[] = [
    "# AI Production Certification FINAL (FASE 22.13)",
    "",
    `Generated: ${report.timestamp}`,
    `Report version: \`${report.report_version}\``,
    `Commit: \`${report.commit_sha}\``,
    `Environment: **${report.environment}**`,
    `Runtime: \`${report.runtime_version}\``,
    `Governance: \`${report.governance_version}\` / contract \`${report.contract_version}\``,
    `**production_ready: ${report.production_ready}**`,
    "",
    "> UNTESTED ≠ PASS. BLOCKED ≠ PASS. DEGRADED ≠ PASS. Sem score geral. Evidência só de execução.",
    "",
    "## 1. Respostas obrigatórias",
    "",
    `1. **O que foi testado?** Probes de certificação (FASE 22.7), readiness DB/RL/KS/E2E (22.9–22.12), runtime canônico, agents, evaluation suite, CI gate.`,
    `2. **Onde foi testado?** \`${report.environment}\` (projeto Lovable/Fit Companion \`47f1291e-…\` quando secrets presentes).`,
    `3. **Quando foi testado?** \`${report.timestamp}\``,
    `4. **Qual commit?** \`${report.commit_sha}\``,
    `5. **Qual environment?** \`${report.environment}\``,
    `6. **Qual runtime?** \`${report.runtime_version}\``,
    `7. **Quais providers?** ${report.providers}`,
    `8. **Quais bancos?** Status DB/migrations: ${report.migrations_status} / database check: ver matriz.`,
    `9. **Quais migrations?** Ver side artifact \`database-readiness\` + check \`migrations\` — ${report.migrations_status}`,
    `10. **Quais riscos?** Critical não-PASS: ${
      report.failures.length ? report.failures.join("; ") : "(nenhum listado — ainda assim production_ready só se todos PASS)"
    }`,
    `11. **Componentes degradados?** ${
      report.checks.filter((c) => c.status === "DEGRADED").map((c) => c.check_id).join(", ") ||
      "(nenhum)"
    }`,
    `12. **Testes que falharam?** ${report.failed_checks.join(", ") || "(nenhum)"}`,
    `13. **Não executados / bloqueados?** UNTESTED: ${
      report.untested_checks.join(", ") || "(nenhum)"
    }; BLOCKED/DEGRADED: ${report.blocked_checks.join(", ") || "(nenhum)"}`,
    `14. **Evidência de cada PASS?** Coluna Evidence da matriz + \`evidence\` JSON no final deste doc.`,
    "",
    "## 2. Production Readiness Matrix",
    "",
    "| COMPONENT | CHECK | STATUS | EVIDENCE | CRITICAL? | BLOCKING? |",
    "|-----------|-------|--------|----------|-----------|-----------|",
  ];

  for (const row of report.components) {
    const ev =
      row.evidence.length > 80 ? `${row.evidence.slice(0, 77)}...` : row.evidence || "—";
    lines.push(
      `| ${row.component} | \`${row.check}\` | **${row.status}** | ${ev.replace(/\|/g, "\\|")} | ${row.critical ? "yes" : "no"} | ${row.blocking ? "yes" : "no"} |`,
    );
  }

  lines.push(
    "",
    "## 3. Failed Checks",
    "",
    ...(report.failed_checks.length
      ? report.failed_checks.map((id) => {
          const c = report.checks.find((x) => x.check_id === id);
          return `- \`${id}\` — ${c?.error ?? "FAIL"}`;
        })
      : ["- (none)"]),
    "",
    "## 4. Blocked / Degraded Checks",
    "",
    ...(report.blocked_checks.length
      ? report.blocked_checks.map((id) => {
          const c = report.checks.find((x) => x.check_id === id);
          return `- \`${id}\` — **${c?.status ?? "BLOCKED"}** ${c?.error ?? ""}`.trim();
        })
      : ["- (none)"]),
    "",
    "## 5. Untested Checks",
    "",
    ...(report.untested_checks.length
      ? report.untested_checks.map((id) => `- \`${id}\``)
      : ["- (none)"]),
    "",
    "## 6. Warnings",
    "",
    ...(report.warnings.length ? report.warnings.map((w) => `- ${w}`) : ["- (none)"]),
    "",
    "## 7. Failures (gate list)",
    "",
    ...(report.failures.length ? report.failures.map((f) => `- ${f}`) : ["- (none)"]),
    "",
    "## 8. Evidence",
    "",
    "```json",
    JSON.stringify(report.evidence, null, 2),
    "```",
    "",
    "## 9. Files / artifacts",
    "",
    `- Note: ${report.files_changed_note}`,
    ...report.side_artifacts.map(
      (s) => `- \`${s.id}\` → \`${s.path}\` verdict=**${s.verdict}**${s.error_code ? ` (${s.error_code})` : ""}`,
    ),
    "",
    "## 10. Tests executed",
    "",
    ...report.tests_executed.map((t) => `- ${t}`),
    "",
    "## 11. Migration status",
    "",
    report.migrations_status,
    "",
    "## 12. Provider status",
    "",
    report.providers,
    "",
    "## 13. RAG status",
    "",
    report.rag_status,
    "",
    "## 14. Memory status",
    "",
    report.memory_status,
    "",
    "## 15. Audit status",
    "",
    report.audit_status,
    "",
    "## 16. E2E status",
    "",
    report.e2e_status,
    "",
    "## 17. Final production_ready",
    "",
    `\`${report.production_ready}\``,
    "",
    "Derivado **exclusivamente** de checks executados (critical EXECUTED+PASS + suite ok + gates 100%).",
    "",
    "## Test suite",
    "",
    "```json",
    JSON.stringify(report.test_suite, null, 2),
    "```",
    "",
    "## Gates",
    "",
    "```json",
    JSON.stringify(report.gates, null, 2),
    "```",
    "",
  );

  return lines.join("\n");
}
