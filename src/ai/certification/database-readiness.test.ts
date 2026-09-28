/**
 * FASE 22.9 — Database Migration Verification tests.
 */
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_REQUIRED_INDEXES,
  AI_REQUIRED_MIGRATIONS,
  AI_REQUIRED_TABLES,
} from "@/ai/certification/ai-schema-inventory";
import {
  evaluateCatalogAgainstInventory,
  verifyAiDatabaseReadiness,
  type AdminDbLike,
  type CatalogProbePayload,
} from "@/ai/certification/verify-database-readiness.server";

function stubDb(opts?: {
  missingTables?: string[];
  blockedTables?: string[];
}): AdminDbLike {
  const missing = new Set(opts?.missingTables ?? []);
  const blocked = new Set(opts?.blockedTables ?? []);
  return {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            async limit(_n: number) {
              if (missing.has(table)) {
                return { error: { message: `relation "${table}" does not exist`, code: "42P01" } };
              }
              if (blocked.has(table)) {
                return { error: { message: "permission denied", code: "42501" } };
              }
              return { error: null };
            },
          };
        },
      };
    },
    async rpc() {
      return { data: null, error: { message: "Could not find the function", code: "PGRST202" } };
    },
  };
}

function fullCatalog(overrides?: Partial<CatalogProbePayload>): CatalogProbePayload {
  return {
    function_present: true,
    extensions: ["vector"],
    tables: [
      ...AI_REQUIRED_TABLES.map((name) => ({ name, rls: true })),
      { name: "recommendation_decisions", rls: true },
      { name: "decision_context_snapshots", rls: true },
      { name: "decision_actions", rls: true },
    ],
    indexes: [...AI_REQUIRED_INDEXES],
    columns: [
      { table: "ai_user_memory", column: "version", udt: "int4" },
      { table: "ai_decision_memory", column: "version", udt: "int4" },
      { table: "ai_outcome_memory", column: "version", udt: "int4" },
      { table: "ai_learning_events", column: "version", udt: "int4" },
      { table: "ai_knowledge_chunks", column: "embedding", udt: "vector" },
    ],
    policies: [],
    ...overrides,
  };
}

describe("FASE 22.9 AI database readiness", () => {
  it("local inventory lists all required migration files on disk", () => {
    const migDir = join(process.cwd(), "supabase", "migrations");
    for (const mig of AI_REQUIRED_MIGRATIONS) {
      expect(existsSync(join(migDir, mig.file)), mig.file).toBe(true);
    }
  });

  it("without admin DB → BLOCKED + MIGRATION_VERIFICATION_BLOCKED", async () => {
    const report = await verifyAiDatabaseReadiness({
      getAdminDb: async () => null,
      persistPath: null,
      environment: "test",
    });
    expect(report.verdict).toBe("BLOCKED");
    expect(report.error_code).toBe("MIGRATION_VERIFICATION_BLOCKED");
    expect(report.checks.some((c) => c.object === "service_role" && c.status === "blocked")).toBe(
      true,
    );
  });

  it("missing local migration file → FAIL", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-db-ready-"));
    writeFileSync(join(dir, "placeholder.txt"), "x");
    const report = await verifyAiDatabaseReadiness({
      migrationsDir: dir,
      getAdminDb: async () => null,
      persistPath: null,
      environment: "test",
    });
    expect(report.verdict).toBe("FAIL");
    expect(report.critical_drift.some((d) => d.startsWith("migration_file:"))).toBe(true);
  });

  it("detects missing index via catalog", () => {
    const catalog = fullCatalog({
      indexes: AI_REQUIRED_INDEXES.filter((i) => i !== "ai_audit_events_decision_id_idx"),
    });
    const { checks, critical_drift } = evaluateCatalogAgainstInventory(catalog, "test");
    expect(critical_drift).toContain("index:ai_audit_events_decision_id_idx");
    expect(
      checks.find(
        (c) => c.object === "index" && c.expected === "ai_audit_events_decision_id_idx",
      )?.status,
    ).toBe("missing");
  });

  it("detects missing table via catalog", () => {
    const catalog = fullCatalog({
      tables: AI_REQUIRED_TABLES.filter((t) => t !== "ai_audit_events").map((name) => ({
        name,
        rls: true,
      })),
    });
    const { critical_drift } = evaluateCatalogAgainstInventory(catalog, "test");
    expect(critical_drift).toContain("table:ai_audit_events");
  });

  it("with mock DB + full catalog → PASS", async () => {
    const report = await verifyAiDatabaseReadiness({
      getAdminDb: async () => stubDb(),
      getCatalog: async () => fullCatalog(),
      persistPath: null,
      environment: "test",
    });
    expect(report.verdict).toBe("PASS");
    expect(report.error_code).toBeUndefined();
    expect(report.critical_drift).toEqual([]);
  });

  it("with mock DB + missing index → FAIL", async () => {
    const report = await verifyAiDatabaseReadiness({
      getAdminDb: async () => stubDb(),
      getCatalog: async () =>
        fullCatalog({
          indexes: AI_REQUIRED_INDEXES.filter((i) => i !== "ai_user_memory_user_idx"),
        }),
      persistPath: null,
      environment: "test",
    });
    expect(report.verdict).toBe("FAIL");
    expect(report.critical_drift).toContain("index:ai_user_memory_user_idx");
  });

  it("catalog unavailable with service_role → BLOCKED (not invent applied)", async () => {
    const report = await verifyAiDatabaseReadiness({
      getAdminDb: async () => stubDb(),
      getCatalog: async () => null,
      persistPath: null,
      environment: "test",
    });
    expect(report.verdict).toBe("BLOCKED");
    expect(report.error_code).toBe("MIGRATION_VERIFICATION_BLOCKED");
    expect(report.checks.some((c) => c.object === "index" && c.status === "blocked")).toBe(true);
  });

  it("persists database-readiness.json when path provided", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-db-persist-"));
    const path = join(dir, "database-readiness.json");
    await verifyAiDatabaseReadiness({
      getAdminDb: async () => null,
      persistPath: path,
      environment: "test",
    });
    expect(existsSync(path)).toBe(true);
  });

  it("writes canonical docs/certification/database-readiness.json artifact", async () => {
    const report = await verifyAiDatabaseReadiness({
      environment: process.env["AI_CERT_ENV"] ?? "local",
    });
    const path = join(process.cwd(), "docs", "certification", "database-readiness.json");
    expect(existsSync(path)).toBe(true);
    expect(["PASS", "BLOCKED", "FAIL"]).toContain(report.verdict);
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      expect(report.verdict).toBe("BLOCKED");
      expect(report.error_code).toBe("MIGRATION_VERIFICATION_BLOCKED");
    }
  });
});
