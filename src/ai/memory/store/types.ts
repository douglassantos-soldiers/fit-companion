/**
 * MemoryStore — persistence abstraction.
 */

import type { MemoryFamily, MemoryRecord } from "@/ai/contracts/memory-record";

export type MemoryStoreListFilter = {
  userId: string;
  family?: MemoryFamily;
  type?: string;
  key?: string;
  includeInvalidated?: boolean;
  limit?: number;
};

export type MemoryStore = {
  insert(record: MemoryRecord): Promise<MemoryRecord>;
  getById(memoryId: string): Promise<MemoryRecord | null>;
  list(filter: MemoryStoreListFilter): Promise<MemoryRecord[]>;
  update(record: MemoryRecord): Promise<MemoryRecord>;
  findActiveByKey(opts: {
    userId: string;
    family: MemoryFamily;
    type: string;
    key: string;
  }): Promise<MemoryRecord | null>;
  clear?(): void;
};

let activeStore: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore {
  if (!activeStore) {
    throw new Error("memory_store_not_registered");
  }
  return activeStore;
}

export function setMemoryStore(store: MemoryStore): void {
  activeStore = store;
}

export function clearMemoryStoreRegistration(): void {
  activeStore = null;
}
