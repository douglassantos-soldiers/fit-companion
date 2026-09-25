/**
 * In-memory MemoryStore (unit tests + default DI).
 */

import type { MemoryRecord } from "@/ai/contracts/memory-record";
import type { MemoryStore, MemoryStoreListFilter } from "@/ai/memory/store/types";

export class InMemoryMemoryStore implements MemoryStore {
  private readonly byId = new Map<string, MemoryRecord>();

  clear(): void {
    this.byId.clear();
  }

  async insert(record: MemoryRecord): Promise<MemoryRecord> {
    this.byId.set(record.memory_id, structuredClone(record));
    return structuredClone(record);
  }

  async getById(memoryId: string): Promise<MemoryRecord | null> {
    const r = this.byId.get(memoryId);
    return r ? structuredClone(r) : null;
  }

  async list(filter: MemoryStoreListFilter): Promise<MemoryRecord[]> {
    const limit = filter.limit ?? 100;
    const out: MemoryRecord[] = [];
    for (const r of this.byId.values()) {
      if (r.user_id !== filter.userId) continue;
      if (filter.family && r.family !== filter.family) continue;
      if (filter.type && r.type !== filter.type) continue;
      if (filter.key !== undefined && r.key !== filter.key) continue;
      if (!filter.includeInvalidated && r.status === "invalidated") continue;
      out.push(structuredClone(r));
    }
    out.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return out.slice(0, limit);
  }

  async update(record: MemoryRecord): Promise<MemoryRecord> {
    this.byId.set(record.memory_id, structuredClone(record));
    return structuredClone(record);
  }

  async findActiveByKey(opts: {
    userId: string;
    family: MemoryRecord["family"];
    type: string;
    key: string;
  }): Promise<MemoryRecord | null> {
    for (const r of this.byId.values()) {
      if (
        r.user_id === opts.userId &&
        r.family === opts.family &&
        r.type === opts.type &&
        r.key === opts.key &&
        r.status === "active"
      ) {
        return structuredClone(r);
      }
    }
    return null;
  }
}
