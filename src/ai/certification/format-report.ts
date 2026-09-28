/**
 * Format CertificationReport as markdown (no side effects).
 */
import type { CertificationReport } from "@/ai/certification/types";

export function formatCertificationMarkdown(report: CertificationReport): string {
  const lines: string[] = [
    "# AI Production Readiness Report",
    "",
    `Generated: ${report.timestamp}`,
    `Report version: ${report.report_version}`,
    `Commit: \`${report.commit_sha}\``,
    `Environment: **${report.environment}**`,
    `**production_ready: ${report.production_ready}**`,
    "",
    "## Test suite",
    "",
    "```json",
    JSON.stringify(report.test_suite, null, 2),
    "```",
    "",
    "## Critical gates",
    "",
    "```json",
    JSON.stringify(report.gates, null, 2),
    "```",
    "",
    "## Checks",
    "",
  ];
  for (const c of report.checks) {
    const mark = c.status === "PASS" ? "x" : " ";
    lines.push(
      `- [${mark}] ${c.name} (\`${c.check_id}\`) — **${c.status}**${c.critical ? " (critical)" : ""}${c.error ? ` — ${c.error}` : ""}`,
    );
  }
  lines.push(
    "",
    "## Failures",
    ...(report.failures.length ? report.failures.map((f) => `- ${f}`) : ["- (none)"]),
  );
  lines.push(
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((w) => `- ${w}`) : ["- (none)"]),
  );
  lines.push("", "## Evidence", "", "```json", JSON.stringify(report.evidence, null, 2), "```", "");
  lines.push(
    "> UNTESTED ≠ PASS. SKIPPED ≠ PASS. Only EXECUTED + PASS satisfies a gate. Do not declare production-ready without a real certification run.",
    "",
  );
  return lines.join("\n");
}
