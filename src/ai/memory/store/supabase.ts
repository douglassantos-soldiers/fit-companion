/**
 * Supabase MemoryStore — service_role only (ai_* tables).
 * FASE 22.3 — ping, version mapping, explicit MEMORY_UNAVAILABLE / STORE_ERROR.
 */

import type { MemoryFamily, MemoryRecord } from "@/ai/contracts/memory-record";
import { MEMORY_ERROR, MemoryError } from "@/ai/memory/core/errors";
import type { MemoryStore, MemoryStoreListFilter } from "@/ai/memory/store/types";

/** Minimal admin client surface (avoids generated-types lag). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseDb = { from: (table: string) => any };

const MEMORY_TABLES = [
  "ai_user_memory",
  "ai_decision_memory",
  "ai_outcome_memory",
  "ai_learning_events",
] as const;

function tableForFamily(family: MemoryFamily): string {
  switch (family) {
    case "user":
      return "ai_user_memory";
    case "decision":
      return "ai_decision_memory";
    case "outcome":
      return "ai_outcome_memory";
    case "learning":
      return "ai_learning_events";
  }
}

function rowToRecord(family: MemoryFamily, row: Record<string, unknown>): MemoryRecord {
  const record: MemoryRecord = {
    memory_id: String(row["id"]),
    user_id: String(row["user_id"]),
    family,
    type: String(row["type"]),
    data: (row["data"] ?? {}) as MemoryRecord["data"],
    source: row["source"] as MemoryRecord["source"],
    confidence: Number(row["confidence"] ?? 0),
    status: row["status"] as MemoryRecord["status"],
    created_at: String(row["created_at"]),
    updated_at: String(row["updated_at"]),
    version: Number(row["version"] ?? 1) || 1,
  };
  if (row["expires_at"]) record.expires_at = String(row["expires_at"]);
  if (row["key"]) record.key = String(row["key"]);
  if (row["low_confidence"] === true) record.low_confidence = true;
  return record;
}

function recordToRow(record: MemoryRecord): Record<string, unknown> {
  return {
    id: record.memory_id,
    user_id: record.user_id,
    type: record.type,
    data: record.data,
    source: record.source,
    confidence: record.confidence,
    status: record.status,
    key: record.key ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
    expires_at: record.expires_at ?? null,
    low_confidence: Boolean(record.low_confidence),
    version: record.version ?? 1,
  };
}

export type SupabaseMemoryStoreOpts = {
  getDb: () => Promise<LooseDb | null>;
};

export class SupabaseMemoryStore implements MemoryStore {
  readonly id = "supabase_memory_v1";

  constructor(private readonly opts: SupabaseMemoryStoreOpts) {}

  private async db(): Promise<LooseDb> {
    let db: LooseDb | null;
    try {
      db = await this.opts.getDb();
    } catch (e) {
      throw new MemoryError(
        MEMORY_ERROR.UNAVAILABLE,
        `MEMORY_UNAVAILABLE: admin_db_error:${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (!db) {
      throw new MemoryError(MEMORY_ERROR.UNAVAILABLE, "MEMORY_UNAVAILABLE: admin_db_unavailable");
    }
    return db;
  }

  async ping(): Promise<boolean> {
    try {
      const db = await this.db();
      for (const table of MEMORY_TABLES) {
        const { error } = await db.from(table).select("id").limit(1);
        if (error) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async insert(record: MemoryRecord): Promise<MemoryRecord> {
    const db = await this.db();
    const { error } = await db.from(tableForFamily(record.family)).insert(recordToRow(record));
    if (error) {
      throw new MemoryError(MEMORY_ERROR.STORE_ERROR, `STORE_ERROR: ${String(error.message)}`);
    }
    return record;
  }

  async getById(memoryId: string, opts?: { userId?: string }): Promise<MemoryRecord | null> {
    const families: MemoryFamily[] = ["user", "decision", "outcome", "learning"];
    const db = await this.db();
    for (const family of families) {
      let q = db.from(tableForFamily(family)).select("*").eq("id", memoryId);
      if (opts?.userId) q = q.eq("user_id", opts.userId);
      const { data, error } = await q.maybeSingle();
      if (error) {
        throw new MemoryError(MEMORY_ERROR.STORE_ERROR, `STORE_ERROR: ${String(error.message)}`);
      }
      if (data) {
        const record = rowToRecord(family, data as Record<string, unknown>);
        if (opts?.userId && record.user_id !== opts.userId) return null;
        return record;
      }
    }
    return null;
  }

  async list(filter: MemoryStoreListFilter): Promise<MemoryRecord[]> {
    if (!filter.userId) {
      throw new MemoryError(MEMORY_ERROR.INVALID_INPUT, "list requires userId");
    }
    const families: MemoryFamily[] = filter.family
      ? [filter.family]
      : ["user", "decision", "outcome", "learning"];
    const db = await this.db();
    const limit = filter.limit ?? 100;
    const out: MemoryRecord[] = [];

    for (const family of families) {
      let q = db.from(tableForFamily(family)).select("*").eq("user_id", filter.userId);
      if (filter.type) q = q.eq("type", filter.type);
      if (filter.key !== undefined) q = q.eq("key", filter.key);
      const { data, error } = await q.order("updated_at", { ascending: false }).limit(limit);
      if (error) {
        throw new MemoryError(MEMORY_ERROR.STORE_ERROR, `STORE_ERROR: ${String(error.message)}`);
      }
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const r = rowToRecord(family, row);
        if (r.user_id !== filter.userId) continue;
        if (!filter.includeInvalidated && r.status === "invalidated") continue;
        out.push(r);
      }
    }

    out.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return out.slice(0, limit);
  }

  async update(record: MemoryRecord): Promise<MemoryRecord> {
    const db = await this.db();
    const { error } = await db
      .from(tableForFamily(record.family))
      .update(recordToRow(record))
      .eq("id", record.memory_id)
      .eq("user_id", record.user_id);
    if (error) {
      throw new MemoryError(MEMORY_ERROR.STORE_ERROR, `STORE_ERROR: ${String(error.message)}`);
    }
    return record;
  }

  async findActiveByKey(opts: {
    userId: string;
    family: MemoryFamily;
    type: string;
    key: string;
  }): Promise<MemoryRecord | null> {
    const db = await this.db();
    const { data, error } = await db
      .from(tableForFamily(opts.family))
      .select("*")
      .eq("user_id", opts.userId)
      .eq("type", opts.type)
      .eq("key", opts.key)
      .eq("status", "active")
      .maybeSingle();
    if (error) {
      throw new MemoryError(MEMORY_ERROR.STORE_ERROR, `STORE_ERROR: ${String(error.message)}`);
    }
    return data ? rowToRecord(opts.family, data as Record<string, unknown>) : null;
  }
}

export async function createSupabaseMemoryStore(): Promise<MemoryStore | null> {
  try {
    const { adminDbLoose } = await import("@/lib/db-admin");
    return new SupabaseMemoryStore(async () => {
      try {
        return await adminDbLoose();
      } catch {
        return null;
      }
    });
  } catch {
    return null;
  }
}
