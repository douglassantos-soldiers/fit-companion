/**
 * RLS harden expectations derived from FASE1/FASE2 migrations (code = source of truth).
 * Remote probe is optional when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are present.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const HARDEN_MIGRATIONS = [
  "20261016120000_fase1_security_authorization_hardening.sql",
  "20261017120000_fase2_identity_authz_defense.sql",
] as const;

export const DANGEROUS_DEPLOY_BUNDLES = [
  "DEPLOY_ALL.sql",
  "DEPLOY_PENDING.sql",
  "DEPLOY_PENDING_HUBS.sql",
  "DEPLOY_HARDEN_20260919.sql",
] as const;

/** Tables that must not expose open anon ALL / USING(true) after harden. */
export const TABLES_MUST_NOT_HAVE_OPEN_ANON = [
  "profiles",
  "sessions",
  "meal_entries",
  "app_state",
  "activity_events",
  "clubs",
  "club_members",
  "challenge_entries",
  "challenge_progress",
  "social_profiles",
  "ai_user_memory",
  "ai_decision_memory",
] as const;

export type MigrationScanFinding = {
  file: string;
  severity: "info" | "warn" | "blocker";
  message: string;
};

export function scanMigrationsForRlsRisk(
  migrationsDir = join(process.cwd(), "supabase", "migrations"),
  deployDir = join(process.cwd(), "supabase"),
): MigrationScanFinding[] {
  const findings: MigrationScanFinding[] = [];

  for (const name of HARDEN_MIGRATIONS) {
    const path = join(migrationsDir, name);
    try {
      const sql = readFileSync(path, "utf8");
      if (!/REVOKE\s+ALL/i.test(sql)) {
        findings.push({
          file: name,
          severity: "blocker",
          message: "harden migration missing REVOKE ALL",
        });
      } else {
        findings.push({
          file: name,
          severity: "info",
          message: "harden migration present with REVOKE ALL",
        });
      }
      if (name.includes("fase2") && !/current_app_user_id/i.test(sql)) {
        findings.push({
          file: name,
          severity: "blocker",
          message: "fase2 missing private.current_app_user_id",
        });
      }
    } catch {
      findings.push({
        file: name,
        severity: "blocker",
        message: "harden migration file missing",
      });
    }
  }

  for (const name of DANGEROUS_DEPLOY_BUNDLES) {
    const path = join(deployDir, name);
    try {
      const sql = readFileSync(path, "utf8");
      if (/USING\s*\(\s*true\s*\)/i.test(sql)) {
        findings.push({
          file: name,
          severity: "warn",
          message:
            "DEPLOY bundle contains USING(true) — must NEVER be re-executed after harden",
        });
      }
    } catch {
      // optional files
    }
  }

  // Early migrations that opened RLS — must be superseded by harden (info for audit trail)
  const early = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => f < "20261016120000");
  let openPolicyFiles = 0;
  for (const f of early) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    if (/USING\s*\(\s*true\s*\)\s*WITH\s+CHECK\s*\(\s*true\s*\)/i.test(sql)) {
      openPolicyFiles += 1;
    }
  }
  findings.push({
    file: "early-migrations",
    severity: "info",
    message: `${openPolicyFiles} early migration files contain USING(true) WITH CHECK(true) — superseded only if FASE1/2 applied remotely`,
  });

  return findings;
}

export type RemoteRlsProbeResult = {
  status: "pass" | "fail" | "pending_operator";
  evidence: string[];
  openPolicies: Array<{ table: string; policy: string }>;
};

/**
 * Probe remote pg_policies via PostgREST RPC if available; otherwise PENDING OPERATOR.
 * Does not invent results — fail-closed to pending when credentials/RPC absent.
 */
export async function probeRemoteRlsPolicies(): Promise<RemoteRlsProbeResult> {
  const url = process.env["SUPABASE_URL"]?.trim();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !key) {
    return {
      status: "pending_operator",
      evidence: [
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY absent in this environment",
        "Cannot prove remote policies match FASE1/FASE2 harden",
        "Operator must run scripts/validate-rls-remote.mjs against production",
      ],
      openPolicies: [],
    };
  }

  // Prefer a dedicated RPC if present; otherwise mark pending with credential presence only.
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/soldiers_rls_audit`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (res.status === 404) {
      return {
        status: "pending_operator",
        evidence: [
          "Service role credentials present",
          "RPC soldiers_rls_audit not deployed — create or run SQL audit manually",
          "See docs/rls-validation.md",
        ],
        openPolicies: [],
      };
    }
    if (!res.ok) {
      return {
        status: "fail",
        evidence: [`RPC soldiers_rls_audit HTTP ${res.status}`],
        openPolicies: [],
      };
    }
    const body = (await res.json()) as {
      open_policies?: Array<{ table: string; policy: string }>;
    };
    const openPolicies = body.open_policies ?? [];
    if (openPolicies.length) {
      return {
        status: "fail",
        evidence: [`Found ${openPolicies.length} open policies`],
        openPolicies,
      };
    }
    return {
      status: "pass",
      evidence: ["RPC soldiers_rls_audit returned zero open policies"],
      openPolicies: [],
    };
  } catch (e) {
    return {
      status: "pending_operator",
      evidence: [
        `Remote probe error: ${e instanceof Error ? e.message : "unknown"}`,
        "Treat as PENDING OPERATOR until manual SQL audit completes",
      ],
      openPolicies: [],
    };
  }
}
