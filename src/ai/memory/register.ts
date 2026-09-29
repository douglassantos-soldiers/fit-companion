/**
 * Bootstrap MemoryStore.
 * FASE 23.4 — production does NOT fire-and-forget ensureMemoryStore.
 * Call initializeAIInfrastructure() / ensureMemoryStore() before critical ops.
 */

import { InMemoryMemoryStore } from "@/ai/memory/store/in-memory";
import {
  clearMemoryStoreRegistration,
  getActiveMemoryStore,
  getMemoryStore,
  setMemoryStore,
} from "@/ai/memory/store/types";
import { resolveMemoryEnvironment } from "@/ai/memory/runtime/env";

let bootstrapped = false;

/**
 * Sync register for tests / explicit DI.
 * Production: registers nothing sync — awaits happen in initializeAIInfrastructure.
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
    // Mark intent only — no async void bootstrap
    bootstrapped = true;
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
  if (resolveMemoryEnvironment() !== "production") {
    registerMemoryInfrastructure({ force: true });
  }
}
