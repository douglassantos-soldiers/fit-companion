/**
 * VectorStore abstraction — Agents never talk to DB directly.
 * FASE 22.2 — ensureVectorStore() is the only resolution path; production never falls back to memory.
 */

import type { KnowledgeChunk } from "@/ai/contracts/knowledge-chunk";
import type { KnowledgeDocument, KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import { RAG_ERROR, RagError } from "@/ai/rag/core/errors";
import { InMemoryVectorStore } from "@/ai/rag/core/vector-store-memory";
import {
  resolveRagEnvironment,
  resolveRagStoreMode,
  type RagEnvironment,
} from "@/ai/rag/runtime/env";

export type StoredVectorHit = {
  document: KnowledgeDocument;
  chunk: KnowledgeChunk;
};

export type VectorQueryOpts = {
  domains?: KnowledgeDomain[];
  metadata?: Record<string, string | number | boolean | null>;
  kbRefs?: string[];
  /** ISO date — only docs effective and not expired as of this instant. */
  asOf?: string;
  topK?: number;
  embedding?: number[];
};

export type VectorStore = {
  readonly id: string;
  upsertEntry(document: KnowledgeDocument, chunks: KnowledgeChunk[]): Promise<void>;
  /** Optional: upsert knowledge source row (Supabase). */
  upsertSource?(source: {
    source_id: string;
    name: string;
    domain: string;
    type?: string;
    version?: string;
    trust_level?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  querySimilar(opts: VectorQueryOpts): Promise<StoredVectorHit[]>;
  listByFilter(opts: VectorQueryOpts): Promise<StoredVectorHit[]>;
  getChunk(chunkId: string): Promise<StoredVectorHit | null>;
  deleteByDocument(documentId: string): Promise<void>;
  clear?(): Promise<void>;
  size?(): Promise<number>;
  /** Health probe — true when store can serve reads. */
  ping?(): Promise<boolean>;
};

let activeStore: VectorStore | null = null;
let ensureInFlight: Promise<VectorStore> | null = null;

export function getActiveVectorStore(): VectorStore | null {
  return activeStore;
}

/**
 * Sync accessor. Prefer `ensureVectorStore()` in async paths.
 * In production, throws if store was never initialized (no silent memory).
 */
export function getVectorStore(): VectorStore {
  if (activeStore) return activeStore;
  const env = resolveRagEnvironment();
  if (env === "production") {
    throw new RagError(
      RAG_ERROR.UNAVAILABLE,
      "RAG_UNAVAILABLE: vector store not initialized — call ensureVectorStore() first",
    );
  }
  activeStore = new InMemoryVectorStore();
  return activeStore;
}

export function setVectorStore(store: VectorStore): void {
  activeStore = store;
}

export function resetVectorStore(): void {
  activeStore = null;
  ensureInFlight = null;
}

async function createSupabaseOrThrow(): Promise<VectorStore> {
  if (typeof window !== "undefined") {
    throw new RagError(
      RAG_ERROR.UNAVAILABLE,
      "RAG_UNAVAILABLE: supabase store is server-only",
    );
  }
  const { createSupabasePgvectorStore } = await import("@/ai/rag/core/vector-store-supabase");
  const store = await createSupabasePgvectorStore();
  if (!store) {
    throw new RagError(
      RAG_ERROR.UNAVAILABLE,
      "RAG_UNAVAILABLE: failed to create SupabasePgvectorStore",
    );
  }
  if (typeof store.ping === "function") {
    const ok = await store.ping();
    if (!ok) {
      throw new RagError(
        RAG_ERROR.UNAVAILABLE,
        "RAG_UNAVAILABLE: supabase/pgvector ping failed",
      );
    }
  }
  return store;
}

/**
 * Canonical store resolution. Production never falls back to InMemory.
 */
export async function ensureVectorStore(opts?: {
  force?: boolean;
  env?: RagEnvironment;
}): Promise<VectorStore> {
  if (activeStore && !opts?.force) return activeStore;
  if (ensureInFlight && !opts?.force) return ensureInFlight;

  ensureInFlight = (async () => {
    const env = opts?.env ?? resolveRagEnvironment();
    let mode: ReturnType<typeof resolveRagStoreMode>;
    try {
      mode = resolveRagStoreMode(env);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new RagError(RAG_ERROR.UNAVAILABLE, msg.startsWith("RAG_") ? msg : `RAG_UNAVAILABLE: ${msg}`);
    }

    if (mode === "supabase") {
      const store = await createSupabaseOrThrow();
      setVectorStore(store);
      return store;
    }

    // development / test — memory allowed
    const mem = new InMemoryVectorStore();
    setVectorStore(mem);
    return mem;
  })();

  try {
    return await ensureInFlight;
  } catch (e) {
    ensureInFlight = null;
    throw e;
  }
}

/**
 * @deprecated Prefer ensureVectorStore(). Kept for API compat; no silent memory fallback when supabase requested.
 */
export async function resolveVectorStoreFromEnv(): Promise<VectorStore> {
  return ensureVectorStore({ force: true });
}
