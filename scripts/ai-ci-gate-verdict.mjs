#!/usr/bin/env node
/**
 * FASE 22.8 — AI CI gate verdict from certification latest.json
 *
 * Exit 1 (FAIL): missing report, suite not executed, critical FAIL/UNTESTED,
 *   or production_ready required but false when SUPABASE_SERVICE_ROLE_KEY is set.
 * Exit 0 + BLOCKED: only remote BLOCKED (no FAIL/UNTESTED critical).
 * Exit 0 + PASS: production_ready true and no blockers.
 *
 * Never treats UNTESTED as PASS.
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const REPORT_PATH = join(process.cwd(), "docs", "certification", "latest.json");

/** Critical checks that must not be FAIL/UNTESTED in CI (architecture/security). */
const LOCAL_CRITICAL = new Set([
  "identity",
  "authorization",
  "safety",
  "decision_engine",
  "proposal_contract",
  "tools",
  "audit",
  "kill_switch",
  "rollback",
  "e2e",
  "cost",
]);

/** Remote/infra probes — BLOCKED without secrets is allowed as CI BLOCKED (not FAIL). */
const REMOTE_ALLOW_BLOCKED = new Set([
  "database",
  "migrations",
  "rag",
  "memory",
  "llm",
  "e2e",
  "rate_limit",
]);

function main() {
  const lines = [];
  const failReasons = [];
  const blocked = [];
  const failed = [];
  const untested = [];

  if (!existsSync(REPORT_PATH)) {
    console.error("AI_CI_GATE: FAIL");
    console.error("reason: certification_report_missing", REPORT_PATH);
    console.error("UNTESTED / missing report cannot be green.");
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
  } catch (e) {
    console.error("AI_CI_GATE: FAIL");
    console.error("reason: certification_report_invalid", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const checks = Array.isArray(report.checks) ? report.checks : [];
  const testSuite = report.test_suite ?? {};

  if (testSuite.executed !== true) {
    failReasons.push("test_suite:not_executed");
  } else if (testSuite.ok !== true) {
    failReasons.push(`test_suite:failed:${testSuite.failed ?? "?"}`);
  }

  for (const c of checks) {
    const id = c.check_id ?? c.id ?? "?";
    const status = String(c.status ?? "UNTESTED");
    const critical = Boolean(c.critical) || LOCAL_CRITICAL.has(id);

    if (status === "UNTESTED") {
      untested.push(id);
      if (critical) failReasons.push(`${id}:UNTESTED`);
    } else if (status === "FAIL") {
      failed.push(id);
      if (critical || LOCAL_CRITICAL.has(id)) failReasons.push(`${id}:FAIL`);
    } else if (status === "BLOCKED" || status === "DEGRADED") {
      blocked.push(id);
      if (critical && !REMOTE_ALLOW_BLOCKED.has(id) && LOCAL_CRITICAL.has(id)) {
        failReasons.push(`${id}:${status}`);
      }
    }
  }

  const hasServiceRole = Boolean(
    process.env["SUPABASE_SERVICE_ROLE_KEY"] &&
      String(process.env["SUPABASE_SERVICE_ROLE_KEY"]).trim().length > 0,
  );

  if (hasServiceRole && report.production_ready !== true) {
    failReasons.push("production_ready:required_with_service_role");
  }

  const uniqFail = [...new Set(failReasons)];

  let gate;
  if (uniqFail.length > 0) {
    gate = "FAIL";
  } else if (blocked.length > 0 || report.production_ready !== true) {
    gate = "BLOCKED";
  } else {
    gate = "PASS";
  }

  lines.push(`## AI CI/CD Safety Gate`);
  lines.push("");
  lines.push(`**AI_CI_GATE: ${gate}**`);
  lines.push("");
  lines.push(`- production_ready: \`${report.production_ready}\``);
  lines.push(`- commit_sha: \`${report.commit_sha ?? "unknown"}\``);
  lines.push(`- environment: \`${report.environment ?? "unknown"}\``);
  lines.push(`- test_suite.executed: \`${testSuite.executed}\` ok: \`${testSuite.ok}\``);
  lines.push(`- FAIL/critical reasons: ${uniqFail.length ? uniqFail.join(", ") : "(none)"}`);
  lines.push(`- blocked/degraded: ${blocked.length ? blocked.join(", ") : "(none)"}`);
  lines.push(`- untested: ${untested.length ? untested.join(", ") : "(none)"}`);
  lines.push("");
  lines.push(
    "> UNTESTED ≠ PASS. Only EXECUTED checks count. Remote BLOCKED without service role → BLOCKED (not green production_ready).",
  );

  console.log(`AI_CI_GATE: ${gate}`);
  console.log(`production_ready: ${report.production_ready}`);
  console.log(`failures: ${uniqFail.join(" | ") || "(none)"}`);
  console.log(`blocked: ${blocked.join(", ") || "(none)"}`);
  console.log(`untested: ${untested.join(", ") || "(none)"}`);
  console.log(`test_suite: executed=${testSuite.executed} ok=${testSuite.ok}`);

  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath) {
    try {
      appendFileSync(summaryPath, lines.join("\n") + "\n");
    } catch {
      /* ignore */
    }
  }

  if (gate === "FAIL") {
    process.exit(1);
  }
  process.exit(0);
}

main();
