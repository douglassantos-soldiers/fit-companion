/**
 * Persist AiAuditEvent to Postgres (service_role). Best-effort — never throws to callers.
 * FASE 11 — dual-write alongside in-memory ring buffer.
 */
import type { AiAuditEvent } from "@/ai/governance/audit";
import { auditEventToRow, rowToAuditEvent, type AiAuditEventRow } from "@/ai/governance/serialize";
import { adminDbLoose } from "@/lib/db-admin";
import { logEngineError } from "@/lib/engine/observability";

const TABLE = "ai_audit_events";

export type PersistAiAuditResult =
  { ok: true; skipped?: boolean; reason?: string } | { ok: false; error: string };

/** Test DI — when set, used instead of adminDbLoose. */
let persistDbOverride: (() => Promise<{ from: (t: string) => unknown } | null>) | null = null;

export function setAiAuditPersistDbForTests(
  getDb: (() => Promise<{ from: (t: string) => unknown } | null>) | null,
): void {
  persistDbOverride = getDb;
}

async function getDb() {
  if (persistDbOverride) return persistDbOverride();
  return adminDbLoose();
}

export async function persistAiAuditEvent(event: AiAuditEvent): Promise<PersistAiAuditResult> {
  try {
    if (process.env["AI_AUDIT_PERSIST"] === "0") {
      return { ok: true, skipped: true, reason: "disabled" };
    }
    const row = auditEventToRow(event);
    if (!row) {
      return { ok: true, skipped: true, reason: "non_uuid_user" };
    }
    const db = await getDb();
    if (!db) {
      return { ok: true, skipped: true, reason: "admin_db_unavailable" };
    }
    const { error } = await db.from(TABLE).upsert(row as AiAuditEventRow, {
      onConflict: "audit_id",
    });
    if (error) {
      logEngineError({
        userId: event.user_id,
        engine: "ai_governance",
        operation: "persist_audit",
        errorCode: "persist_failed",
        message: String(error.message ?? error),
      });
      return { ok: false, error: String(error.message ?? error) };
    }
    return { ok: true };
  } catch (e) {
    logEngineError({
      userId: event.user_id,
      engine: "ai_governance",
      operation: "persist_audit",
      errorCode: "persist_exception",
      message: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function loadAuditsByRunId(userId: string, runId: string): Promise<AiAuditEvent[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .or(`run_id.eq.${runId},parent_run_id.eq.${runId}`)
      .order("created_at", { ascending: true });
    if (error) {
      logEngineError({
        userId,
        engine: "ai_governance",
        operation: "load_audits_by_run",
        errorCode: "load_failed",
        message: String(error.message ?? error),
      });
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map(rowToAuditEvent);
  } catch (e) {
    logEngineError({
      userId,
      engine: "ai_governance",
      operation: "load_audits_by_run",
      errorCode: "load_exception",
      message: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

export async function loadAuditsForUser(
  userId: string,
  opts?: { since?: string; limit?: number },
): Promise<AiAuditEvent[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
    let q = db
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (opts?.since) {
      q = q.gte("created_at", opts.since);
    }
    const { data, error } = await q;
    if (error) {
      logEngineError({
        userId,
        engine: "ai_governance",
        operation: "load_audits_for_user",
        errorCode: "load_failed",
        message: String(error.message ?? error),
      });
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map(rowToAuditEvent);
  } catch (e) {
    logEngineError({
      userId,
      engine: "ai_governance",
      operation: "load_audits_for_user",
      errorCode: "load_exception",
      message: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

export type LoadAuditsAdminOpts = {
  since?: string;
  until?: string;
  kind?: string;
  agent_id?: string;
  status?: string;
  user_id?: string;
  model?: string;
  /** Opaque cursor = created_at ISO of last row (descending pages). */
  cursor?: string;
  limit?: number;
};

export type LoadAuditsAdminResult = {
  audits: AiAuditEvent[];
  source: "db" | "unavailable";
  next_cursor: string | null;
};

/**
 * Admin-wide paginated audit load (service_role). Never unbounded.
 */
export async function loadAuditsAdmin(
  opts: LoadAuditsAdminOpts = {},
): Promise<LoadAuditsAdminResult> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  try {
    const db = await getDb();
    if (!db) return { audits: [], source: "unavailable", next_cursor: null };

    let q = db.from(TABLE).select("*").order("created_at", { ascending: false }).limit(limit + 1);
    if (opts.since) q = q.gte("created_at", opts.since);
    if (opts.until) q = q.lte("created_at", opts.until);
    if (opts.kind) q = q.eq("kind", opts.kind);
    if (opts.agent_id) q = q.eq("agent_id", opts.agent_id);
    if (opts.status) q = q.eq("status", opts.status);
    if (opts.user_id) q = q.eq("user_id", opts.user_id);
    if (opts.model) q = q.eq("model", opts.model);
    if (opts.cursor) q = q.lt("created_at", opts.cursor);

    const { data, error } = await q;
    if (error) {
      logEngineError({
        userId: "admin",
        engine: "ai_governance",
        operation: "load_audits_admin",
        errorCode: "load_failed",
        message: String(error.message ?? error),
      });
      return { audits: [], source: "unavailable", next_cursor: null };
    }
    const rows = ((data ?? []) as Record<string, unknown>[]).map(rowToAuditEvent);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const next_cursor =
      hasMore && page.length > 0 ? (page[page.length - 1]?.created_at ?? null) : null;
    return { audits: page, source: "db", next_cursor };
  } catch (e) {
    logEngineError({
      userId: "admin",
      engine: "ai_governance",
      operation: "load_audits_admin",
      errorCode: "load_exception",
      message: e instanceof Error ? e.message : String(e),
    });
    return { audits: [], source: "unavailable", next_cursor: null };
  }
}

/** Fire-and-forget persist from recordAudit (server-only). Observational path. */
export function schedulePersistAiAudit(event: AiAuditEvent): void {
  if (typeof window !== "undefined") return;
  if (process.env["AI_AUDIT_PERSIST"] === "0") return;
  void persistAiAuditEvent(event);
}

/**
 * CRITICAL audit persist — await + one retry. Still never throws to product callers
 * when used via schedule path; returns result for certification / ops.
 */
export async function persistCriticalAiAudit(event: AiAuditEvent): Promise<PersistAiAuditResult> {
  if (typeof window !== "undefined") {
    return { ok: true, skipped: true, reason: "client" };
  }
  if (process.env["AI_AUDIT_PERSIST"] === "0") {
    return { ok: true, skipped: true, reason: "disabled" };
  }
  let result = await persistAiAuditEvent(event);
  if (!result.ok) {
    result = await persistAiAuditEvent(event);
    if (!result.ok) {
      logEngineError({
        userId: event.user_id,
        engine: "ai_governance",
        operation: "persist_critical_audit",
        errorCode: "critical_persist_failed",
        message: result.error,
      });
    }
  }
  return result;
}

/** Route by durability: critical awaits; observational fire-and-forget. */
export function schedulePersistAiAuditByDurability(
  event: AiAuditEvent,
  durability: "critical" | "observational",
): void {
  if (typeof window !== "undefined") return;
  if (process.env["AI_AUDIT_PERSIST"] === "0") return;
  if (durability === "critical") {
    void persistCriticalAiAudit(event);
    return;
  }
  void persistAiAuditEvent(event);
}
