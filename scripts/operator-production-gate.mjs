#!/usr/bin/env node
/**
 * Operator production gate — local proofs + optional live probes.
 * Exit codes:
 *   0 = all release-blocking checks PASS
 *   1 = FAIL on a runnable check
 *   3 = PENDING OPERATOR (credentials/live proof missing) — not a silent PASS
 *
 * Env (live):
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — RLS/RAG remote probes
 *   E2E_ACCESS_EMAIL + E2E_ACCESS_PASSWORD — Playwright authenticated suite
 *
 * Operator-filled evidence (wipe, backup, shopify/cron, leaked-password, optional RAG):
 *   Copy docs/certification/operator-live-proofs.template.json
 *   → docs/certification/operator-live-proofs.json and set status "pass" with dated detail.
 *
 * Usage:
 *   npm run gate:operator
 *   node --experimental-strip-types scripts/operator-production-gate.mjs
 *
 * Evidence head is always the current git HEAD (must match the published SHA for cert).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function run(cmd, args, envExtra = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    env: { ...process.env, ...envExtra },
  });
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

/** Non-blocking statuses (beta-deferred) must not force exit 3. */
const BLOCKING_PENDING = new Set([
  "rls_remote_probe",
  "rag_remote_probe",
  "e2e_authenticated",
  "account_deletion_live",
  "backup_restore_drill",
  "shopify_cron_staging",
  "leaked_password_protection",
]);

function loadLiveProofs() {
  const path = join(process.cwd(), "docs", "certification", "operator-live-proofs.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.warn("operator-live-proofs.json unreadable", e);
    return null;
  }
}

function recordFromLiveProofs(live, name, fallbackDetail) {
  const entry = live?.[name];
  if (entry && entry.status === "pass" && entry.at && entry.detail) {
    record(name, "pass", `${entry.at} — ${entry.detail}`);
    return true;
  }
  if (entry && entry.status === "fail") {
    record(name, "fail", entry.detail || "operator_live_proof_fail");
    return true;
  }
  record(name, "pending_operator", fallbackDetail);
  return false;
}

// Local Vitest gates
const vitestTargets = [
  "src/lib/security/rls-validation.test.ts",
  "src/ai/rag/rag-readiness.test.ts",
  "src/lib/account-deletion.test.ts",
  "src/lib/progress/photos-ownership.test.ts",
  "src/lib/security/identity-cron.test.ts",
  "src/lib/account-status.cache.test.ts",
];
const vt = run("npx", ["vitest", "run", ...vitestTargets]);
record(
  "local_vitest_operator_suite",
  vt.code === 0 ? "pass" : "fail",
  vt.code === 0 ? "ok" : (vt.stderr || vt.stdout).slice(0, 400),
);

const live = loadLiveProofs();

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
  if (remote.status === "pass") {
    record("rls_remote_probe", "pass", remote.evidence.join(" | "));
  } else if (remote.status === "fail") {
    record("rls_remote_probe", "fail", remote.evidence.join(" | "));
  } else {
    recordFromLiveProofs(
      live,
      "rls_remote_probe",
      remote.evidence.join(" | ") ||
        "Run: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → node scripts/validate-rls-remote.mjs",
    );
  }
} catch (e) {
  recordFromLiveProofs(
    live,
    "rls_remote_probe",
    e instanceof Error ? e.message : "import_error",
  );
}

// Remote RAG
try {
  const { probeRemoteRagPopulation, assertLocalKnowledgeFilesPresent } = await import(
    "../src/ai/rag/rag-readiness.ts"
  );
  const local = assertLocalKnowledgeFilesPresent();
  record("rag_local_allowlist", local.ok ? "pass" : "fail", local.ok ? "ok" : local.missing.join(","));
  const rag = await probeRemoteRagPopulation();
  if (rag.status === "pass") {
    record("rag_remote_probe", "pass", rag.evidence.join(" | "));
  } else if (rag.status === "fail") {
    record("rag_remote_probe", "fail", rag.evidence.join(" | "));
  } else {
    recordFromLiveProofs(
      live,
      "rag_remote_probe",
      rag.evidence.join(" | ") || "Run npm run rag:seed with SUPABASE_* then re-run gate",
    );
  }
} catch (e) {
  recordFromLiveProofs(
    live,
    "rag_remote_probe",
    e instanceof Error ? e.message : "import_error",
  );
}

// E2E authenticated — run Playwright when both email + password are set
const e2eEmail = process.env["E2E_ACCESS_EMAIL"]?.trim();
const e2ePassword = process.env["E2E_ACCESS_PASSWORD"]?.trim();
if (e2eEmail && e2ePassword) {
  const e2e = run("npx", ["playwright", "test", "e2e/authenticated.spec.ts"], {
    E2E_ACCESS_EMAIL: e2eEmail,
    E2E_ACCESS_PASSWORD: e2ePassword,
  });
  if (e2e.code === 0) {
    record("e2e_authenticated", "pass", "playwright e2e/authenticated.spec.ts exit 0");
  } else {
    record(
      "e2e_authenticated",
      "fail",
      (e2e.stderr || e2e.stdout).slice(0, 500) || "playwright auth suite failed",
    );
  }
} else {
  recordFromLiveProofs(
    live,
    "e2e_authenticated",
    "Set E2E_ACCESS_EMAIL + E2E_ACCESS_PASSWORD (entitlement) or record pass in operator-live-proofs.json after manual Playwright run",
  );
}

// Wipe live / backup / shopify / leaked-password — operator evidence file
recordFromLiveProofs(
  live,
  "account_deletion_live",
  "Fill docs/certification/operator-live-proofs.json after controlled wipe BEFORE/AFTER (service_role)",
);
recordFromLiveProofs(
  live,
  "backup_restore_drill",
  "Fill operator-live-proofs.json after docs/backup-dr.md restore drill (dated)",
);
recordFromLiveProofs(
  live,
  "shopify_cron_staging",
  "Staging webhook HMAC + cron daily-pushes smoke — record in operator-live-proofs.json",
);
recordFromLiveProofs(
  live,
  "leaked_password_protection",
  "Enable leaked-password protection in Supabase Auth dashboard — record in operator-live-proofs.json",
);

// Wearables: beta-deferred — does not block gate exit
record(
  "wearables_integration",
  "deferred_beta",
  "OAuth smoke deferred (acceptable for beta). Not a release-blocking check.",
);

const outDir = join(process.cwd(), "docs", "certification");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "operator-gate-evidence.json");
writeFileSync(outPath, JSON.stringify(evidence, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`Evidence head: ${evidence.head} (must equal published site SHA for certification)`);

const failed = evidence.checks.some((c) => c.status === "fail");
const pending = evidence.checks.some(
  (c) => c.status === "pending_operator" && BLOCKING_PENDING.has(c.name),
);
if (failed) process.exit(1);
if (pending) {
  console.error("PENDING OPERATOR: live proofs incomplete — production_ready must stay false");
  process.exit(3);
}
console.log("ALL PASS");
process.exit(0);
