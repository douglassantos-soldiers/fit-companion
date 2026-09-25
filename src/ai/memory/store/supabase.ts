/**
 * Supabase MemoryStore — service_role only (ai_* tables).
 * Unit tests use InMemoryMemoryStore; this adapter is for server runtime.
 */

import type { MemoryFamily, MemoryRecord } from "@/ai/contracts/memory-record";
import { MEMORY_ERROR, MemoryError } from "@/ai/memory/core/errors";
import type { MemoryStore, MemoryStoreListFilter } from "@/ai/memory/store/types";

/** Minimal admin client surface (avoids generated-types lag). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseDb = { from: (table: string) => any };

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
  };
}

export type SupabaseMemoryStoreOpts = {
  getDb: () => Promise<LooseDb | null>;
};

export class SupabaseMemoryStore implements MemoryStore {
  constructor(private readonly opts: SupabaseMemoryStoreOpts) {}

  private async db(): Promise<LooseDb> {
    const db = await this.opts.getDb();
    if (!db) throw new MemoryError(MEMORY_ERROR.STORE_ERROR, "admin_db_unavailable");
    return db;
  }

  async insert(record: MemoryRecord): Promise<MemoryRecord> {
    const db = await this.db();
    const { error } = await db.from(tableForFamily(record.family)).insert(recordToRow(record));
    if (error) throw new MemoryError(MEMORY_ERROR.STORE_ERROR, String(error.message));
    return record;
  }

  async getById(memoryId: string): Promise<MemoryRecord | null> {
    const families: MemoryFamily[] = ["user", "decision", "outcome", "learning"];
    const db = await this.db();
    for (const family of families) {
      const { data, error } = await db
        .from(tableForFamily(family))
        .select("*")
        .eq("id", memoryId)
        .maybeSingle();
      if (error) throw new MemoryError(MEMORY_ERROR.STORE_ERROR, String(error.message));
      if (data) return rowToRecord(family, data as Record<string, unknown>);
    }
    return null;
  }

  async list(filter: MemoryStoreListFilter): Promise<MemoryRecord[]> {
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
      if (error) throw new MemoryError(MEMORY_ERROR.STORE_ERROR, String(error.message));
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const r = rowToRecord(family, row);
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
      .eq("id", record.memory_id);
    if (error) throw new MemoryError(MEMORY_ERROR.STORE_ERROR, String(error.message));
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
    if (error) throw new MemoryError(MEMORY_ERROR.STORE_ERROR, String(error.message));
    return data ? rowToRecord(opts.family, data as Record<string, unknown>) : null;
  }
}
