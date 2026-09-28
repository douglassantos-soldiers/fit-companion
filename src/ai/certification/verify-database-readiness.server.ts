/**
 * FASE 22.9 — Deep AI database readiness verification.
 * PASS only with complete remote probe green. No adminDb → BLOCKED.
 * Never invent "applied" without service_role evidence.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AI_ADJACENT_TABLES,
  AI_REQUIRED_COLUMNS,
  AI_REQUIRED_EXTENSIONS,
  AI_REQUIRED_INDEXES,
  AI_REQUIRED_MIGRATIONS,
  AI_REQUIRED_TABLES,
  AI_RLS_EXPECTATION,
} from "@/ai/certification/ai-schema-inventory";

export type SchemaCheckStatus =
  | "pass"
  | "missing"
  | "pending"
  | "drift"
  | "blocked"
  | "na"
  | "observed";

export type SchemaCheckRow = {
  migration?: string;
  object: string;
  expected: string;
  actual: string;
  status: SchemaCheckStatus;
  environment: string;
  detail?: string;
};

export type DatabaseReadinessVerdict = "PASS" | "BLOCKED" | "FAIL";

export type DatabaseReadinessReport = {
  report_version: "fase22_9_v1";
  checked_at: string;
  environment: string;
  verdict: DatabaseReadinessVerdict;
  error_code?: "MIGRATION_VERIFICATION_BLOCKED";
  checks: SchemaCheckRow[];
  critical_drift: string[];
};

export type CatalogProbePayload = {
  extensions?: string[];
  tables?: Array<{ name: string; rls: boolean }>;
  indexes?: string[];
  columns?: Array<{ table: string; column: string; udt?: string }>;
  policies?: Array<{
    table: string;
    policy: string;
    roles: string[] | string;
    cmd?: string;
  }>;
  function_present?: boolean;
};

export type AdminDbLike = {
  from: (table: string) => {
    select: (cols: string) => {
      limit: (n: number) => Promise<{ error: { message?: string; code?: string } | null }>;
    };
  };
  rpc?: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export type DatabaseReadinessDeps = {
  migrationsDir?: string;
  environment?: string;
  /** Inject admin client; default = adminDbLoose(). */
  getAdminDb?: () => Promise<AdminDbLike | null>;
  /** Inject catalog JSON (tests); default = rpc ai_schema_inventory_probe. */
  getCatalog?: (db: AdminDbLike) => Promise<CatalogProbePayload | null>;
  /** Persist JSON report; null = skip. Default docs/certification/database-readiness.json */
  persistPath?: string | null;
};

function envName(explicit?: string): string {
  return (
    explicit ??
    process.env["AI_CERT_ENV"] ??
    process.env["AI_LLM_ENV"] ??
    process.env["NODE_ENV"] ??
    "unknown"
  );
}

function row(
  environment: string,
  partial: Omit<SchemaCheckRow, "environment">,
): SchemaCheckRow {
  return { ...partial, environment };
}

async function defaultGetCatalog(db: AdminDbLike): Promise<CatalogProbePayload | null> {
  if (typeof db.rpc !== "function") return null;
  const { data, error } = await db.rpc("ai_schema_inventory_probe");
  if (error) {
    const msg = String(error.message ?? error.code ?? "");
    if (/does not exist|Could not find|PGRST202|42883/i.test(msg)) return null;
    throw new Error(`ai_schema_inventory_probe: ${msg}`);
  }
  if (!data || typeof data !== "object") return null;
  return data as CatalogProbePayload;
}

async function probeTableSelect(
  db: AdminDbLike,
  table: string,
): Promise<"pass" | "missing" | "blocked"> {
  try {
    const { error } = await db.from(table).select("*").limit(1);
    if (!error) return "pass";
    const msg = String(error.message ?? error.code ?? "");
    if (/does not exist|schema cache|42P01|not find|Could not find the table/i.test(msg)) {
      return "missing";
    }
    return "blocked";
  } catch {
    return "blocked";
  }
}

function policyTouchesClientRole(roles: string[] | string | undefined): boolean {
  const list = Array.isArray(roles)
    ? roles
    : typeof roles === "string"
      ? roles.replace(/[{}]/g, "").split(",").map((s) => s.trim())
      : [];
  return list.some((r) => r === "anon" || r === "authenticated" || r === "public");
}

export function evaluateCatalogAgainstInventory(
  catalog: CatalogProbePayload,
  environment: string,
): { checks: SchemaCheckRow[]; critical_drift: string[] } {
  const checks: SchemaCheckRow[] = [];
  const critical_drift: string[] = [];
  const tableMap = new Map((catalog.tables ?? []).map((t) => [t.name, t]));
  const indexSet = new Set(catalog.indexes ?? []);
  const extSet = new Set(catalog.extensions ?? []);
  const colSet = new Set(
    (catalog.columns ?? []).map((c) => `${c.table}.${c.column}`),
  );

  for (const ext of AI_REQUIRED_EXTENSIONS) {
    const ok = extSet.has(ext);
    checks.push(
      row(environment, {
        object: "extension",
        expected: ext,
        actual: ok ? ext : "absent",
        status: ok ? "pass" : "missing",
        detail: ok ? "pgvector" : "extension_vector_missing",
      }),
    );
    if (!ok) critical_drift.push(`extension:${ext}`);
  }

  for (const table of AI_REQUIRED_TABLES) {
    const meta = tableMap.get(table);
    if (!meta) {
      checks.push(
        row(environment, {
          object: "table",
          expected: table,
          actual: "absent",
          status: "missing",
        }),
      );
      critical_drift.push(`table:${table}`);
      continue;
    }
    checks.push(
      row(environment, {
        object: "table",
        expected: table,
        actual: table,
        status: "pass",
      }),
    );
    const rlsOk = meta.rls === AI_RLS_EXPECTATION.row_security;
    checks.push(
      row(environment, {
        object: "rls",
        expected: `ENABLE on ${table}`,
        actual: meta.rls ? "enabled" : "disabled",
        status: rlsOk ? "pass" : "drift",
        ...(rlsOk ? {} : { detail: "rls_disabled" }),
      }),
    );
    if (!rlsOk) critical_drift.push(`rls:${table}`);
  }

  for (const adj of AI_ADJACENT_TABLES) {
    const meta = tableMap.get(adj);
    checks.push(
      row(environment, {
        object: "table_adjacent",
        expected: adj,
        actual: meta ? adj : "absent",
        status: "observed",
        detail: "non_blocking_for_ai_pass",
      }),
    );
  }

  for (const idx of AI_REQUIRED_INDEXES) {
    const ok = indexSet.has(idx);
    checks.push(
      row(environment, {
        object: "index",
        expected: idx,
        actual: ok ? idx : "absent",
        status: ok ? "pass" : "missing",
        ...(ok ? {} : { detail: "index_missing" }),
      }),
    );
    if (!ok) critical_drift.push(`index:${idx}`);
  }

  for (const col of AI_REQUIRED_COLUMNS) {
    const key = `${col.table}.${col.column}`;
    const ok = colSet.has(key);
    checks.push(
      row(environment, {
        object: "column",
        expected: key,
        actual: ok ? key : "absent",
        status: ok ? "pass" : "missing",
      }),
    );
    if (!ok) critical_drift.push(`column:${key}`);
  }

  const policies = catalog.policies ?? [];
  const clientPolicies = policies.filter((p) => policyTouchesClientRole(p.roles));
  checks.push(
    row(environment, {
      object: "grant_policy",
      expected: "0 anon/authenticated policies on AI tables",
      actual: String(clientPolicies.length),
      status: clientPolicies.length === 0 ? "pass" : "drift",
      detail:
        clientPolicies.length === 0
          ? "service_role_only"
          : clientPolicies.map((p) => `${p.table}:${p.policy}`).join(","),
    }),
  );
  if (clientPolicies.length > 0) {
    critical_drift.push("rls:client_policies_present");
  }

  checks.push(
    row(environment, {
      object: "function",
      expected: "ai_schema_inventory_probe",
      actual: catalog.function_present ? "present" : "unknown",
      status: catalog.function_present ? "pass" : "pending",
      migration: "20261031120000_fase22_9_ai_schema_verify.sql",
    }),
  );

  return { checks, critical_drift };
}

export async function verifyAiDatabaseReadiness(
  deps: DatabaseReadinessDeps = {},
): Promise<DatabaseReadinessReport> {
  const checked_at = new Date().toISOString();
  const environment = envName(deps.environment);
  const migrationsDir =
    deps.migrationsDir ?? join(process.cwd(), "supabase", "migrations");
  const checks: SchemaCheckRow[] = [];
  const critical_drift: string[] = [];

  // 1) Local migration files
  for (const mig of AI_REQUIRED_MIGRATIONS) {
    const path = join(migrationsDir, mig.file);
    const exists = existsSync(path);
    checks.push(
      row(environment, {
        migration: mig.file,
        object: "migration_file",
        expected: mig.file,
        actual: exists ? "present" : "absent",
        status: exists ? "pass" : "missing",
        ...(exists ? {} : { detail: "local_inventory_fail" }),
      }),
    );
    if (!exists) critical_drift.push(`migration_file:${mig.file}`);
  }

  const localFail = critical_drift.some((d) => d.startsWith("migration_file:"));

  // 2) Remote access
  let db: AdminDbLike | null = null;
  try {
    if (deps.getAdminDb) {
      db = await deps.getAdminDb();
    } else {
      const { adminDbLoose } = await import("@/lib/db-admin");
      db = (await adminDbLoose()) as AdminDbLike | null;
    }
  } catch (e) {
    db = null;
    checks.push(
      row(environment, {
        object: "service_role",
        expected: "admin_db",
        actual: "error",
        status: "blocked",
        detail: e instanceof Error ? e.message : String(e),
      }),
    );
  }

  if (!db) {
    checks.push(
      row(environment, {
        object: "service_role",
        expected: "SUPABASE_SERVICE_ROLE_KEY + select",
        actual: "unavailable",
        status: "blocked",
        detail: "admin_db_unavailable",
      }),
    );
    const report: DatabaseReadinessReport = {
      report_version: "fase22_9_v1",
      checked_at,
      environment,
      verdict: localFail ? "FAIL" : "BLOCKED",
      ...(localFail ? {} : { error_code: "MIGRATION_VERIFICATION_BLOCKED" as const }),
      checks,
      critical_drift,
    };
    persistReport(report, deps.persistPath);
    return report;
  }

  checks.push(
    row(environment, {
      object: "service_role",
      expected: "admin client",
      actual: "available",
      status: "pass",
      detail: "service_role_client_ok",
    }),
  );

  // 3) Table SELECT probes (evidence of service_role access)
  for (const table of AI_REQUIRED_TABLES) {
    const st = await probeTableSelect(db, table);
    checks.push(
      row(environment, {
        object: "table_select",
        expected: table,
        actual: st,
        status: st === "pass" ? "pass" : st === "missing" ? "missing" : "blocked",
        detail: st === "pass" ? "select_ok" : st,
      }),
    );
    if (st === "missing") critical_drift.push(`table_select:${table}`);
    if (st === "blocked") critical_drift.push(`table_select_blocked:${table}`);
  }

  // 4) Catalog via RPC (indexes / RLS / pgvector / columns)
  let catalog: CatalogProbePayload | null = null;
  try {
    catalog = deps.getCatalog
      ? await deps.getCatalog(db)
      : await defaultGetCatalog(db);
  } catch (e) {
    checks.push(
      row(environment, {
        object: "catalog_probe",
        expected: "ai_schema_inventory_probe",
        actual: "error",
        status: "blocked",
        detail: e instanceof Error ? e.message : String(e),
      }),
    );
  }

  if (!catalog) {
    checks.push(
      row(environment, {
        object: "catalog_probe",
        expected: "ai_schema_inventory_probe",
        actual: "unavailable",
        status: "blocked",
        detail:
          "rpc_missing_or_unexposed — apply 20261031120000_fase22_9_ai_schema_verify.sql",
        migration: "20261031120000_fase22_9_ai_schema_verify.sql",
      }),
    );
    // Column fallback via select
    for (const col of AI_REQUIRED_COLUMNS) {
      try {
        const { error } = await db.from(col.table).select(col.column).limit(1);
        const ok = !error;
        const missing =
          !!error &&
          /column|Could not find|42703/i.test(String(error.message ?? error.code ?? ""));
        checks.push(
          row(environment, {
            object: "column",
            expected: `${col.table}.${col.column}`,
            actual: ok ? "present" : missing ? "absent" : "unknown",
            status: ok ? "pass" : missing ? "missing" : "blocked",
            detail: "select_fallback_without_catalog",
          }),
        );
        if (!ok && missing) critical_drift.push(`column:${col.table}.${col.column}`);
      } catch (e) {
        checks.push(
          row(environment, {
            object: "column",
            expected: `${col.table}.${col.column}`,
            actual: "error",
            status: "blocked",
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      }
    }
    for (const idx of AI_REQUIRED_INDEXES) {
      checks.push(
        row(environment, {
          object: "index",
          expected: idx,
          actual: "unverified",
          status: "blocked",
          detail: "catalog_probe_unavailable",
        }),
      );
    }
    checks.push(
      row(environment, {
        object: "extension",
        expected: "vector",
        actual: "unverified",
        status: "blocked",
        detail: "catalog_probe_unavailable",
      }),
    );

    const report: DatabaseReadinessReport = {
      report_version: "fase22_9_v1",
      checked_at,
      environment,
      verdict: "BLOCKED",
      error_code: "MIGRATION_VERIFICATION_BLOCKED",
      checks,
      critical_drift,
    };
    persistReport(report, deps.persistPath);
    return report;
  }

  const evaluated = evaluateCatalogAgainstInventory(catalog, environment);
  checks.push(...evaluated.checks);
  critical_drift.push(...evaluated.critical_drift);

  const hasMissingOrDrift = critical_drift.some(
    (d) =>
      d.startsWith("table:") ||
      d.startsWith("index:") ||
      d.startsWith("extension:") ||
      d.startsWith("column:") ||
      d.startsWith("rls:") ||
      d.startsWith("table_select:") ||
      d.startsWith("migration_file:"),
  );
  const hasBlockedSelect = critical_drift.some((d) =>
    d.startsWith("table_select_blocked:"),
  );

  let verdict: DatabaseReadinessVerdict = "PASS";
  let error_code: DatabaseReadinessReport["error_code"];
  if (localFail || hasMissingOrDrift) {
    verdict = "FAIL";
  } else if (hasBlockedSelect) {
    verdict = "BLOCKED";
    error_code = "MIGRATION_VERIFICATION_BLOCKED";
  }

  const report: DatabaseReadinessReport = {
    report_version: "fase22_9_v1",
    checked_at,
    environment,
    verdict,
    ...(error_code ? { error_code } : {}),
    checks,
    critical_drift: [...new Set(critical_drift)],
  };
  persistReport(report, deps.persistPath);
  return report;
}

function persistReport(
  report: DatabaseReadinessReport,
  persistPath: string | null | undefined,
): void {
  if (persistPath === null) return;
  const path =
    persistPath ?? join(process.cwd(), "docs", "certification", "database-readiness.json");
  try {
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, JSON.stringify(report, null, 2), "utf8");
  } catch {
    // Non-fatal: CI/read-only FS
  }
}
