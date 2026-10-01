#!/usr/bin/env node
/**
 * Assert certification preconditions before claiming production_ready.
 * Exit 0 only when operator-gate-evidence.json has no blocking pending/fail
 * and head matches current HEAD.
 *
 * Usage: node scripts/assert-cert-ready.mjs
 *        npm run cert:assert-ready
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const BLOCKING = new Set([
  "local_vitest_operator_suite",
  "rls_migration_scan",
  "rls_remote_probe",
  "rag_local_allowlist",
  "rag_remote_probe",
  "e2e_authenticated",
  "account_deletion_live",
  "backup_restore_drill",
  "shopify_cron_staging",
  // leaked_password_protection may be deferred_beta for controlled beta
]);

const evidencePath = join(process.cwd(), "docs", "certification", "operator-gate-evidence.json");
if (!existsSync(evidencePath)) {
  console.error("Missing operator-gate-evidence.json — run npm run gate:operator first");
  process.exit(3);
}

const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();

if (evidence.head !== head) {
  console.error(
    `Evidence head mismatch: evidence=${evidence.head} git=${head}\nRe-run npm run gate:operator on the published SHA.`,
  );
  process.exit(3);
}

const checks = evidence.checks ?? [];
const failed = checks.filter((c) => BLOCKING.has(c.name) && c.status === "fail");
const pending = checks.filter((c) => BLOCKING.has(c.name) && c.status === "pending_operator");
const missing = [...BLOCKING].filter((name) => !checks.some((c) => c.name === name));
const leak = checks.find((c) => c.name === "leaked_password_protection");
if (leak && leak.status === "fail") {
  failed.push(leak);
}

if (failed.length || pending.length || missing.length) {
  console.error("Not ready to certify production:");
  for (const c of failed) console.error(`  FAIL ${c.name}: ${c.detail}`);
  for (const c of pending) console.error(`  PENDING ${c.name}: ${c.detail}`);
  for (const m of missing) console.error(`  MISSING ${m}`);
  console.error("See docs/certification/CERTIFY_PRODUCTION.md");
  process.exit(3);
}

if (leak && leak.status === "deferred_beta") {
  console.log(`Note: leaked_password_protection is deferred_beta — OK for controlled beta, enable before full production_ready`);
}

console.log(`Cert-ready: evidence head ${head} — all blocking checks pass`);
console.log("Next: republish if needed, then npm run ai:certification:final");
process.exit(0);
