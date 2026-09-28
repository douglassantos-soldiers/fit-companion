/**
 * MemoryStore — persistence abstraction.
 * FASE 22.3 — ensureMemoryStore() is the only resolution path; production never falls back to memory.
 */

import type { MemoryFamily, MemoryRecord } from "@/ai/contracts/memory-record";
import { MEMORY_ERROR, MemoryError } from "@/ai/memory/core/errors";
import { InMemoryMemoryStore } from "@/ai/memory/store/in-memory";
import {
  resolveMemoryEnvironment,
  resolveMemoryStoreMode,
  type MemoryEnvironment,
} from "@/ai/memory/runtime/env";

export type MemoryStoreListFilter = {
  userId: string;
  family?: MemoryFamily;
  type?: string;
  key?: string;
  includeInvalidated?: boolean;
  limit?: number;
};

export type MemoryStore = {
  readonly id?: string;
  insert(record: MemoryRecord): Promise<MemoryRecord>;
  getById(memoryId: string, opts?: { userId?: string }): Promise<MemoryRecord | null>;
  list(filter: MemoryStoreListFilter): Promise<MemoryRecord[]>;
  update(record: MemoryRecord): Promise<MemoryRecord>;
  findActiveByKey(opts: {
    userId: string;
    family: MemoryFamily;
    type: string;
    key: string;
  }): Promise<MemoryRecord | null>;
  clear?(): void;
  /** Health probe — true when store can serve reads. */
  ping?(): Promise<boolean>;
};

let activeStore: MemoryStore | null = null;
let ensureInFlight: Promise<MemoryStore> | null = null;

export function getActiveMemoryStore(): MemoryStore | null {
  return activeStore;
}

/**
 * Sync accessor. Prefer `ensureMemoryStore()` in async paths.
 * In production, throws if store was never initialized (no silent InMemory).
 */
export function getMemoryStore(): MemoryStore {
  if (activeStore) return activeStore;
  const env = resolveMemoryEnvironment();
  if (env === "production") {
    throw new MemoryError(
      MEMORY_ERROR.UNAVAILABLE,
      "MEMORY_UNAVAILABLE: memory store not initialized — call ensureMemoryStore() first",
    );
  }
  activeStore = new InMemoryMemoryStore();
  return activeStore;
}

export function setMemoryStore(store: MemoryStore): void {
  activeStore = store;
}

export function clearMemoryStoreRegistration(): void {
  activeStore = null;
  ensureInFlight = null;
}

export function resetMemoryStoreRegistration(): void {
  clearMemoryStoreRegistration();
}

async function createSupabaseOrThrow(): Promise<MemoryStore> {
  if (typeof window !== "undefined") {
    throw new MemoryError(
      MEMORY_ERROR.UNAVAILABLE,
      "MEMORY_UNAVAILABLE: supabase store is server-only",
    );
  }
  const { createSupabaseMemoryStore } = await import("@/ai/memory/store/supabase");
  const store = await createSupabaseMemoryStore();
  if (!store) {
    throw new MemoryError(
      MEMORY_ERROR.UNAVAILABLE,
      "MEMORY_UNAVAILABLE: failed to create SupabaseMemoryStore",
    );
  }
  if (typeof store.ping === "function") {
    const ok = await store.ping();
    if (!ok) {
      throw new MemoryError(
        MEMORY_ERROR.UNAVAILABLE,
        "MEMORY_UNAVAILABLE: supabase memory ping failed",
      );
    }
  }
  return store;
}

/**
 * Canonical store resolution. Production never falls back to InMemory.
 */
export async function ensureMemoryStore(opts?: {
  force?: boolean;
  env?: MemoryEnvironment;
}): Promise<MemoryStore> {
  if (activeStore && !opts?.force) return activeStore;
  if (ensureInFlight && !opts?.force) return ensureInFlight;

  ensureInFlight = (async () => {
    const env = opts?.env ?? resolveMemoryEnvironment();
    let mode: ReturnType<typeof resolveMemoryStoreMode>;
    try {
      mode = resolveMemoryStoreMode(env);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new MemoryError(
        MEMORY_ERROR.UNAVAILABLE,
        msg.startsWith("MEMORY_") ? msg : `MEMORY_UNAVAILABLE: ${msg}`,
      );
    }

    if (mode === "supabase") {
      const store = await createSupabaseOrThrow();
      setMemoryStore(store);
      return store;
    }

    // development / test — memory allowed
    const mem = new InMemoryMemoryStore();
    setMemoryStore(mem);
    return mem;
  })();

  try {
    return await ensureInFlight;
  } catch (e) {
    ensureInFlight = null;
    throw e;
  }
}
