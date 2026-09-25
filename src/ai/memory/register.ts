/**
 * Bootstrap default InMemory MemoryStore.
 */

import { InMemoryMemoryStore } from "@/ai/memory/store/in-memory";
import { getMemoryStore, setMemoryStore } from "@/ai/memory/store/types";

let bootstrapped = false;
let defaultStore: InMemoryMemoryStore | null = null;

export function registerMemoryInfrastructure(opts?: { force?: boolean }): InMemoryMemoryStore {
  if (bootstrapped && !opts?.force) {
    return defaultStore ?? (getMemoryStore() as InMemoryMemoryStore);
  }
  defaultStore = new InMemoryMemoryStore();
  setMemoryStore(defaultStore);
  bootstrapped = true;
  return defaultStore;
}

export function resetMemoryInfrastructure(): void {
  if (defaultStore) defaultStore.clear();
  registerMemoryInfrastructure({ force: true });
}
