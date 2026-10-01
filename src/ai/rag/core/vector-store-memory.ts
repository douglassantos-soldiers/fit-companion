/**
 * In-memory VectorStore — wraps Map-based knowledge store (tests / default).
 */

import type { KnowledgeChunk } from "@/ai/contracts/knowledge-chunk";
import type { KnowledgeDocument, KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import { expandDomainFilter } from "@/ai/contracts/knowledge-document";
import {
  clearKnowledgeStore,
  deleteKnowledgeDocument,
  knowledgeStoreSize,
  listKnowledgeChunks,
  upsertKnowledgeEntry,
} from "@/ai/rag/core/store";
import type { StoredVectorHit, VectorQueryOpts, VectorStore } from "@/ai/rag/core/vector-store";
import { cosineSimilarity } from "@/ai/rag/embeddings";

function isFresh(doc: KnowledgeDocument, asOf: string): boolean {
  const t = Date.parse(asOf);
  if (!Number.isFinite(t)) return true;
  if (doc.effective_date && Date.parse(doc.effective_date) > t) return false;
  if (doc.expiration_date) {
    const exp = Date.parse(doc.expiration_date);
    if (Number.isFinite(exp) && exp < t) return false;
  }
  if (doc.status === "superseded") return false;
  // Soldiers KB stays draft until CREF/CRN review, but it is retrievable.
  if (doc.status === "draft") return doc.metadata["trust_level"] === "draft_internal";
  return true;
}

export class InMemoryVectorStore implements VectorStore {
  readonly id = "memory_v1";

  async upsertEntry(document: KnowledgeDocument, chunks: KnowledgeChunk[]): Promise<void> {
    upsertKnowledgeEntry({ document, chunks });
  }

  async listByFilter(opts: VectorQueryOpts): Promise<StoredVectorHit[]> {
    const domains = expandDomainFilter(opts.domains);
    const hits = listKnowledgeChunks({
      ...(domains ? { domains } : {}),
      ...(opts.metadata ? { metadata: opts.metadata } : {}),
      ...(opts.kbRefs ? { kbRefs: opts.kbRefs } : {}),
    });
    const asOf = opts.asOf ?? new Date().toISOString();
    return hits.filter((h) => isFresh(h.document, asOf));
  }

  async querySimilar(opts: VectorQueryOpts): Promise<StoredVectorHit[]> {
    const candidates = await this.listByFilter(opts);
    const emb = opts.embedding;
    if (!emb || emb.length === 0) return candidates;
    const scored = candidates
      .map((h) => {
        const cEmb = h.chunk.embedding ?? [];
        const sim = cosineSimilarity(emb, cEmb);
        return { hit: h, sim };
      })
      .sort((a, b) => b.sim - a.sim);
    const topK = opts.topK ?? 50;
    return scored.slice(0, topK).map((s) => s.hit);
  }

  async getChunk(chunkId: string): Promise<StoredVectorHit | null> {
    const all = listKnowledgeChunks();
    return all.find((h) => h.chunk.chunk_id === chunkId) ?? null;
  }

  async deleteByDocument(documentId: string): Promise<void> {
    deleteKnowledgeDocument(documentId);
  }

  async clear(): Promise<void> {
    clearKnowledgeStore();
  }

  async size(): Promise<number> {
    return knowledgeStoreSize();
  }

  async ping(): Promise<boolean> {
    return true;
  }
}
