/**
 * Canonical AI tables that must exist for production (FASE 21).
 * Never assume Git migration == applied remotely.
 */
export const AI_REQUIRED_TABLES = [
  "ai_audit_events",
  "ai_user_memory",
  "ai_decision_memory",
  "ai_outcome_memory",
  "ai_learning_events",
  "ai_knowledge_sources",
  "ai_knowledge_documents",
  "ai_knowledge_chunks",
] as const;

export type MigrationTableStatus = "applied" | "missing" | "unavailable";

export type MigrationTableProbe = {
  table: string;
  status: MigrationTableStatus;
  detail?: string;
};

export type MigrationVerifyResult = {
  checked_at: string;
  tables: MigrationTableProbe[];
  all_applied: boolean;
  any_unavailable: boolean;
};

async function probeTable(
  db: {
    from: (t: string) => {
      select: (c: string) => {
        limit: (n: number) => Promise<{ error: { message?: string; code?: string } | null }>;
      };
    };
  },
  table: string,
): Promise<MigrationTableProbe> {
  try {
    const { error } = await db.from(table).select("*").limit(1);
    if (!error) return { table, status: "applied" };
    const msg = String(error.message ?? error.code ?? "error");
    if (/does not exist|schema cache|42P01|not find|Could not find the table/i.test(msg)) {
      return { table, status: "missing", detail: msg };
    }
    if (/permission|rls|policy|JWT/i.test(msg)) {
      return { table, status: "applied", detail: msg };
    }
    return { table, status: "unavailable", detail: msg };
  } catch (e) {
    return {
      table,
      status: "unavailable",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function verifyAiMigrations(): Promise<MigrationVerifyResult> {
  const checked_at = new Date().toISOString();
  try {
    const { adminDbLoose } = await import("@/lib/db-admin");
    const db = await adminDbLoose();
    if (!db) {
      return {
        checked_at,
        tables: AI_REQUIRED_TABLES.map((table) => ({
          table,
          status: "unavailable" as const,
          detail: "admin_db_unavailable",
        })),
        all_applied: false,
        any_unavailable: true,
      };
    }
    const tables: MigrationTableProbe[] = [];
    for (const t of AI_REQUIRED_TABLES) {
      tables.push(await probeTable(db as never, t));
    }
    return {
      checked_at,
      tables,
      all_applied: tables.every((t) => t.status === "applied"),
      any_unavailable: tables.some((t) => t.status === "unavailable"),
    };
  } catch (e) {
    return {
      checked_at,
      tables: AI_REQUIRED_TABLES.map((table) => ({
        table,
        status: "unavailable" as const,
        detail: e instanceof Error ? e.message : String(e),
      })),
      all_applied: false,
      any_unavailable: true,
    };
  }
}
