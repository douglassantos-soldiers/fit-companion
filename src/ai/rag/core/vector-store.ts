/**
 * VectorStore abstraction — Agents never talk to DB directly.
 */

import type { KnowledgeChunk } from "@/ai/contracts/knowledge-chunk";
import type { KnowledgeDocument, KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import { InMemoryVectorStore } from "@/ai/rag/core/vector-store-memory";

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
  querySimilar(opts: VectorQueryOpts): Promise<StoredVectorHit[]>;
  listByFilter(opts: VectorQueryOpts): Promise<StoredVectorHit[]>;
  getChunk(chunkId: string): Promise<StoredVectorHit | null>;
  deleteByDocument(documentId: string): Promise<void>;
  clear?(): Promise<void>;
  size?(): Promise<number>;
};

let activeStore: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!activeStore) {
    activeStore = new InMemoryVectorStore();
  }
  return activeStore;
}

export function setVectorStore(store: VectorStore): void {
  activeStore = store;
}

export function resetVectorStore(): void {
  activeStore = null;
}

/** Resolve store from env: memory (default) | supabase */
export async function resolveVectorStoreFromEnv(): Promise<VectorStore> {
  const mode = (process.env["AI_RAG_STORE"] ?? "memory").toLowerCase();
  if (mode === "supabase" && typeof window === "undefined") {
    try {
      const { createSupabasePgvectorStore } = await import("@/ai/rag/core/vector-store-supabase");
      const store = await createSupabasePgvectorStore();
      if (store) {
        setVectorStore(store);
        return store;
      }
    } catch {
      /* fall through to memory */
    }
  }
  const mem = new InMemoryVectorStore();
  setVectorStore(mem);
  return mem;
}
