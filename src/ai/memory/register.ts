/**
 * Bootstrap MemoryStore.
 * FASE 22.3 — production uses ensureMemoryStore (Supabase); InMemory only test/dev.
 */

import { InMemoryMemoryStore } from "@/ai/memory/store/in-memory";
import {
  clearMemoryStoreRegistration,
  ensureMemoryStore,
  getActiveMemoryStore,
  getMemoryStore,
  setMemoryStore,
} from "@/ai/memory/store/types";
import { resolveMemoryEnvironment } from "@/ai/memory/runtime/env";

let bootstrapped = false;

/**
 * Sync register for tests / explicit DI.
 * Production: does NOT create InMemory — kicks off async ensureMemoryStore.
 */
export function registerMemoryInfrastructure(opts?: {
  force?: boolean;
}): InMemoryMemoryStore | null {
  const env = resolveMemoryEnvironment();

  if (env === "production") {
    if (opts?.force) {
      clearMemoryStoreRegistration();
      bootstrapped = false;
    }
    if (!bootstrapped) {
      bootstrapped = true;
      if (typeof window === "undefined") {
        void (async () => {
          try {
            await ensureMemoryStore();
          } catch (e) {
            console.error(
              "[memory] production bootstrap error:",
              e instanceof Error ? e.message : String(e),
            );
          }
        })();
      }
    }
    return null;
  }

  if (bootstrapped && !opts?.force) {
    const active = getActiveMemoryStore();
    if (active instanceof InMemoryMemoryStore) return active;
    return getMemoryStore() as InMemoryMemoryStore;
  }

  const store = new InMemoryMemoryStore();
  setMemoryStore(store);
  bootstrapped = true;
  return store;
}

export function resetMemoryInfrastructure(): void {
  const active = getActiveMemoryStore();
  if (active && typeof active.clear === "function") active.clear();
  clearMemoryStoreRegistration();
  bootstrapped = false;
  // Tests / dev: re-register InMemory
  if (resolveMemoryEnvironment() !== "production") {
    registerMemoryInfrastructure({ force: true });
  }
}
