#!/usr/bin/env node
/**
 * Operator RLS validation entrypoint.
 * Usage: node scripts/validate-rls-remote.mjs
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and (optionally) RPC soldiers_rls_audit.
 */
import { probeRemoteRlsPolicies, scanMigrationsForRlsRisk } from "../src/lib/security/rls-validation.ts";

const scan = scanMigrationsForRlsRisk();
console.log("--- migration scan ---");
for (const f of scan) {
  console.log(`[${f.severity}] ${f.file}: ${f.message}`);
}
if (scan.some((f) => f.severity === "blocker")) {
  console.error("BLOCKER: harden migrations incomplete in repo");
  process.exit(2);
}

const remote = await probeRemoteRlsPolicies();
console.log("--- remote probe ---");
console.log(JSON.stringify(remote, null, 2));

if (remote.status === "fail") process.exit(1);
if (remote.status === "pending_operator") {
  console.error("PENDING OPERATOR: remote RLS not proven in this environment");
  process.exit(3);
}
console.log("PASS");
