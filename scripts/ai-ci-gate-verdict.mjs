#!/usr/bin/env node
/**
 * FASE 22.8 / 23.11 — AI CI STRUCTURAL gate verdict from certification latest.json
 *
 * STRUCTURAL (default):
 *   Exit 1 (FAIL): missing report, suite not executed, critical FAIL/UNTESTED.
 *   Exit 0 + BLOCKED: remote BLOCKED without secrets (explicit — not production-ready).
 *   Exit 0 + PASS: production_ready true and no blockers.
 *
 * PRODUCTION RELEASE (AI_RELEASE_GATE=1):
 *   Exit != 0 for any critical BLOCKED/FAIL/UNKNOWN/STALE/DEGRADED,
 *   production_ready !== true, or commit mismatch vs HEAD.
 *
 * Never treats UNTESTED / BLOCKED / DEGRADED as PASS.
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const REPORT_PATH = join(process.cwd(), "docs", "certification", "latest.json");

const RELEASE_GATE =
  process.env["AI_RELEASE_GATE"] === "1" ||
  process.env["AI_RELEASE_GATE"] === "true" ||
  process.argv.includes("--release");

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

/** Remote/infra probes — BLOCKED without secrets is allowed as CI STRUCTURAL BLOCKED (not FAIL). */
const REMOTE_ALLOW_BLOCKED = new Set([
  "database",
  "migrations",
  "rag",
  "memory",
  "llm",
  "e2e",
  "rate_limit",
]);

function resolveHeadSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function main() {
  const lines = [];
  const failReasons = [];
  const blocked = [];
  const failed = [];
  const untested = [];
  const gateKind = RELEASE_GATE ? "PRODUCTION_RELEASE" : "CI_STRUCTURAL";

  if (!existsSync(REPORT_PATH)) {
    console.error(`AI_CI_GATE: FAIL (${gateKind})`);
    console.error("reason: certification_report_missing", REPORT_PATH);
    console.error("UNTESTED / missing report cannot be green.");
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
  } catch (e) {
    console.error(`AI_CI_GATE: FAIL (${gateKind})`);
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

    if (status === "UNTESTED" || status === "UNKNOWN") {
      untested.push(id);
      if (critical) failReasons.push(`${id}:${status}`);
    } else if (status === "FAIL") {
      failed.push(id);
      if (critical || LOCAL_CRITICAL.has(id)) failReasons.push(`${id}:FAIL`);
    } else if (status === "BLOCKED" || status === "DEGRADED") {
      blocked.push(id);
      if (RELEASE_GATE && critical) {
        failReasons.push(`${id}:${status}`);
      } else if (critical && !REMOTE_ALLOW_BLOCKED.has(id) && LOCAL_CRITICAL.has(id)) {
        failReasons.push(`${id}:${status}`);
      }
    }
  }

  const head = resolveHeadSha();
  const reportSha = String(report.commit_sha ?? "");
  if (head && reportSha && reportSha !== "unknown") {
    const match =
      head === reportSha || head.startsWith(reportSha) || reportSha.startsWith(head.slice(0, 12));
    if (!match) {
      failReasons.push(`CERTIFICATION_STALE:report=${reportSha.slice(0, 12)} head=${head.slice(0, 12)}`);
    }
  }

  const hasServiceRole = Boolean(
    process.env["SUPABASE_SERVICE_ROLE_KEY"] &&
      String(process.env["SUPABASE_SERVICE_ROLE_KEY"]).trim().length > 0,
  );

  if (RELEASE_GATE) {
    if (report.production_ready !== true) {
      failReasons.push("production_ready:required_for_release");
    }
    if (blocked.length > 0) {
      // already added critical blocked above; ensure any remaining remote blocked fail release
      for (const id of blocked) {
        if (!failReasons.some((r) => r.startsWith(`${id}:`))) {
          failReasons.push(`${id}:BLOCKED_release`);
        }
      }
    }
  } else if (hasServiceRole && report.production_ready !== true) {
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

  lines.push(`## AI CI/CD Safety Gate (${gateKind})`);
  lines.push("");
  lines.push(`**AI_CI_GATE: ${gate}**`);
  lines.push("");
  lines.push(`- gate_kind: \`${gateKind}\``);
  lines.push(`- production_ready: \`${report.production_ready}\``);
  lines.push(`- commit_sha: \`${report.commit_sha ?? "unknown"}\``);
  lines.push(`- head_sha: \`${head ?? "unknown"}\``);
  lines.push(`- environment: \`${report.environment ?? "unknown"}\``);
  if (blocked.length) lines.push(`- blocked: ${blocked.join(", ")}`);
  if (failed.length) lines.push(`- failed: ${failed.join(", ")}`);
  if (untested.length) lines.push(`- untested: ${untested.join(", ")}`);
  if (uniqFail.length) {
    lines.push(`- fail_reasons:`);
    for (const r of uniqFail) lines.push(`  - ${r}`);
  }
  lines.push("");
  if (gateKind === "CI_STRUCTURAL" && gate === "BLOCKED") {
    lines.push(
      "_Structural gate: remote BLOCKED is exit 0 (not production-ready). Use `AI_RELEASE_GATE=1` / `npm run ai:release-verdict` for release._",
    );
  }

  const body = lines.join("\n");
  console.log(body);

  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath) {
    try {
      appendFileSync(summaryPath, body + "\n");
    } catch {
      /* ignore */
    }
  }

  if (gate === "FAIL") process.exit(1);
  // STRUCTURAL: BLOCKED → exit 0. RELEASE: BLOCKED already folded into FAIL above.
  process.exit(0);
}

main();
