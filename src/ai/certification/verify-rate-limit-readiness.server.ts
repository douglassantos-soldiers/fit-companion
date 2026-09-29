/**
 * FASE 22.10 — Rate-limit readiness (PASS | BLOCKED | FAIL).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adminDbLoose } from "@/lib/db-admin";
import {
  SharedMemoryRateLimitStore,
  type RateLimitStore,
} from "@/ai/runtime/rate-limit-store";
import { checkAiRateLimits } from "@/ai/runtime/rate-limit";

export type RateLimitReadinessVerdict = "PASS" | "BLOCKED" | "FAIL";

export type RateLimitReadinessReport = {
  report_version: "fase22_10_v1";
  checked_at: string;
  environment: string;
  verdict: RateLimitReadinessVerdict;
  error_code?: "RATE_LIMIT_VERIFICATION_BLOCKED";
  checks: Array<{
    object: string;
    expected: string;
    actual: string;
    status: "pass" | "missing" | "blocked" | "fail";
    detail?: string;
  }>;
};

const MIGRATION = "20261101120000_fase22_10_ai_rate_limits.sql";

export async function verifyAiRateLimitReadiness(opts?: {
  migrationsDir?: string;
  environment?: string;
  persistPath?: string | null;
  store?: RateLimitStore;
}): Promise<RateLimitReadinessReport> {
  const checked_at = new Date().toISOString();
  const environment =
    opts?.environment ??
    process.env["AI_CERT_ENV"] ??
    process.env["NODE_ENV"] ??
    "unknown";
  const checks: RateLimitReadinessReport["checks"] = [];
  const migDir = opts?.migrationsDir ?? join(process.cwd(), "supabase", "migrations");
  const migPath = join(migDir, MIGRATION);
  const migOk = existsSync(migPath);
  checks.push({
    object: "migration_file",
    expected: MIGRATION,
    actual: migOk ? "present" : "absent",
    status: migOk ? "pass" : "missing",
  });

  // Local logic smoke (always)
  const mem = new SharedMemoryRateLimitStore();
  process.env["AI_RL_USER_RPM"] = "2";
  const a = await checkAiRateLimits({ userId: `rl_ready_${Date.now()}` }, mem);
  const b = await checkAiRateLimits({ userId: a.ok ? `rl_ready_${Date.now()}` : "x" }, mem);
  // use fixed user for trip
  const uid = `rl_trip_${Date.now()}`;
  const t1 = await checkAiRateLimits({ userId: uid }, mem);
  const t2 = await checkAiRateLimits({ userId: uid }, mem);
  const t3 = await checkAiRateLimits({ userId: uid }, mem);
  delete process.env["AI_RL_USER_RPM"];
  const localTrip = t1.ok && t2.ok && !t3.ok;
  checks.push({
    object: "local_logic",
    expected: "trip_on_third",
    actual: localTrip ? "trip_ok" : "trip_failed",
    status: localTrip ? "pass" : "fail",
  });
  void a;
  void b;

  let remoteOk = false;
  let remoteDetail = "skipped";
  try {
    const db = await adminDbLoose();
    if (!db || typeof (db as { rpc?: unknown }).rpc !== "function") {
      checks.push({
        object: "service_role",
        expected: "admin_db",
        actual: "unavailable",
        status: "blocked",
        detail: "admin_db_unavailable",
      });
    } else {
      checks.push({
        object: "service_role",
        expected: "admin_db",
        actual: "available",
        status: "pass",
      });
      const rpc = (
        db as unknown as {
          rpc: (
            fn: string,
            args?: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
        }
      ).rpc;
      const key = `ai:readiness:${Date.now()}`;
      const { data, error } = await rpc("ai_rate_limit_consume", {
        p_key: key,
        p_limit: 2,
        p_window_ms: 60_000,
        p_amount: 1,
        p_peek: false,
      });
      if (error) {
        remoteDetail = String(error.message ?? error.code ?? "rpc_error");
        checks.push({
          object: "rpc",
          expected: "ai_rate_limit_consume",
          actual: "error",
          status: /does not exist|PGRST202|42883/i.test(remoteDetail) ? "blocked" : "fail",
          detail: remoteDetail,
        });
      } else if (data && typeof data === "object" && (data as { allowed?: boolean }).allowed) {
        remoteOk = true;
        checks.push({
          object: "rpc",
          expected: "ai_rate_limit_consume",
          actual: "ok",
          status: "pass",
        });
      } else {
        checks.push({
          object: "rpc",
          expected: "ai_rate_limit_consume",
          actual: "unexpected",
          status: "fail",
          detail: JSON.stringify(data),
        });
      }
    }
  } catch (e) {
    checks.push({
      object: "service_role",
      expected: "admin_db",
      actual: "error",
      status: "blocked",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  let verdict: RateLimitReadinessVerdict = "PASS";
  let error_code: RateLimitReadinessReport["error_code"];
  if (!migOk || !localTrip) {
    verdict = "FAIL";
  } else if (!remoteOk) {
    verdict = "BLOCKED";
    error_code = "RATE_LIMIT_VERIFICATION_BLOCKED";
  }

  const report: RateLimitReadinessReport = {
    report_version: "fase22_10_v1",
    checked_at,
    environment,
    verdict,
    ...(error_code ? { error_code } : {}),
    checks,
  };

  if (opts?.persistPath !== null) {
    const path =
      opts?.persistPath ??
      join(process.cwd(), "docs", "certification", "rate-limit-readiness.json");
    try {
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, JSON.stringify(report, null, 2), "utf8");
    } catch {
      /* ignore */
    }
  }

  return report;
}
