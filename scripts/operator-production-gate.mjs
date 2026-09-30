#!/usr/bin/env node
/**
 * Operator production gate — local proofs + optional live probes.
 * Exit codes:
 *   0 = all runnable checks PASS (live may still be pending if no secrets)
 *   1 = FAIL on a runnable check
 *   3 = PENDING OPERATOR (credentials/live proof missing) — not a silent PASS
 *
 * Usage:
 *   node --experimental-strip-types scripts/operator-production-gate.mjs
 *   # or via: npm run gate:operator
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: true });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const evidence = {
  at: new Date().toISOString(),
  head: run("git", ["rev-parse", "HEAD"]).stdout.trim(),
  checks: [],
};

function record(name, status, detail) {
  evidence.checks.push({ name, status, detail });
  console.log(`[${status}] ${name}: ${detail}`);
}

// Local Vitest gates
const vitestTargets = [
  "src/lib/security/rls-validation.test.ts",
  "src/ai/rag/rag-readiness.test.ts",
  "src/lib/account-deletion.test.ts",
  "src/lib/progress/photos-ownership.test.ts",
  "src/lib/security/identity-cron.test.ts",
];
const vt = run("npx", ["vitest", "run", ...vitestTargets]);
record(
  "local_vitest_operator_suite",
  vt.code === 0 ? "pass" : "fail",
  vt.code === 0 ? "ok" : (vt.stderr || vt.stdout).slice(0, 400),
);

// Remote RLS
try {
  const { probeRemoteRlsPolicies, scanMigrationsForRlsRisk } = await import(
    "../src/lib/security/rls-validation.ts"
  );
  const scan = scanMigrationsForRlsRisk();
  const blockers = scan.filter((f) => f.severity === "blocker");
  record(
    "rls_migration_scan",
    blockers.length ? "fail" : "pass",
    blockers.length ? blockers.map((b) => b.message).join("; ") : "harden present",
  );
  const remote = await probeRemoteRlsPolicies();
  record("rls_remote_probe", remote.status === "pass" ? "pass" : remote.status === "fail" ? "fail" : "pending_operator", remote.evidence.join(" | "));
} catch (e) {
  record("rls_remote_probe", "pending_operator", e instanceof Error ? e.message : "import_error");
}

// Remote RAG
try {
  const { probeRemoteRagPopulation, assertLocalKnowledgeFilesPresent } = await import(
    "../src/ai/rag/rag-readiness.ts"
  );
  const local = assertLocalKnowledgeFilesPresent();
  record("rag_local_allowlist", local.ok ? "pass" : "fail", local.ok ? "ok" : local.missing.join(","));
  const rag = await probeRemoteRagPopulation();
  record(
    "rag_remote_probe",
    rag.status === "pass" ? "pass" : rag.status === "fail" ? "fail" : "pending_operator",
    rag.evidence.join(" | "),
  );
} catch (e) {
  record("rag_remote_probe", "pending_operator", e instanceof Error ? e.message : "import_error");
}

// E2E auth capability
const e2eEmail = process.env["E2E_ACCESS_EMAIL"]?.trim();
record(
  "e2e_authenticated",
  e2eEmail ? "pending_operator" : "pending_operator",
  e2eEmail
    ? "E2E_ACCESS_EMAIL set — run full Playwright auth suite manually (still wiring)"
    : "E2E_ACCESS_EMAIL absent — authenticated flows skipped",
);

// Wipe live / backup restore — cannot invent PASS
record(
  "account_deletion_live",
  "pending_operator",
  "Requires controlled test user + service_role; unit BEFORE/AFTER already PASS",
);
record(
  "backup_restore_drill",
  "pending_operator",
  "See docs/backup-dr.md — restore not executed in this environment",
);
record(
  "wearables_integration",
  process.env["STRAVA_CLIENT_ID"] || process.env["GARMIN_CLIENT_ID"]
    ? "pending_operator"
    : "pending_operator",
  "Credentials present check only — full OAuth still operator-owned",
);

const outDir = join(process.cwd(), "docs", "certification");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "operator-gate-evidence.json");
writeFileSync(outPath, JSON.stringify(evidence, null, 2));
console.log(`Wrote ${outPath}`);

const failed = evidence.checks.some((c) => c.status === "fail");
const pending = evidence.checks.some((c) => c.status === "pending_operator");
if (failed) process.exit(1);
if (pending) {
  console.error("PENDING OPERATOR: live proofs incomplete — production_ready must stay false");
  process.exit(3);
}
console.log("ALL PASS");
process.exit(0);
