/**
 * Knowledge ingestion — SOURCE → FETCH → VALIDATE → NORMALIZE → CHUNK → METADATA → EMBED → INDEX → VERSION
 * FASE 22.2 — ensureVectorStore; idempotent seed report.
 */

import type { KnowledgeDocument } from "@/ai/contracts/knowledge-document";
import { KNOWLEDGE_DOMAINS } from "@/ai/contracts/knowledge-document";
import { chunkDocument } from "@/ai/rag/chunking";
import { RAG_ERROR, RagError } from "@/ai/rag/core/errors";
import { requireSourceAdapter } from "@/ai/rag/core/registry";
import { getKnowledgeEntry, hasKnowledgeDocument } from "@/ai/rag/core/store";
import type { IngestOptions, IngestResult } from "@/ai/rag/core/types";
import { ensureVectorStore, getActiveVectorStore } from "@/ai/rag/core/vector-store";
import { getEmbeddingProvider } from "@/ai/rag/embeddings";
import { PRODUCT_KNOWLEDGE_CORPUS } from "@/ai/rag/corpus/product-knowledge";

export type SeedCorpusReport = {
  ok: boolean;
  store_id: string;
  sources: number;
  documents: number;
  chunks: number;
  results: IngestResult[];
  error?: string;
};

function assertDocument(doc: KnowledgeDocument): void {
  if (!doc.document_id?.trim()) {
    throw new RagError(RAG_ERROR.INVALID_DOCUMENT, "document_id_required");
  }
  if (!doc.title?.trim()) {
    throw new RagError(RAG_ERROR.INVALID_DOCUMENT, "title_required");
  }
  if (!doc.content?.trim()) {
    throw new RagError(RAG_ERROR.INVALID_DOCUMENT, "content_required");
  }
  if (!KNOWLEDGE_DOMAINS.includes(doc.domain)) {
    throw new RagError(RAG_ERROR.UNKNOWN_DOMAIN, `domain:${doc.domain}`);
  }
  if (!doc.version?.trim()) {
    throw new RagError(RAG_ERROR.INVALID_DOCUMENT, "version_required");
  }
}

function normalizeDocument(doc: KnowledgeDocument): KnowledgeDocument {
  const content = doc.content.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  const sourceId =
    doc.source_id ??
    (typeof doc.metadata["source_id"] === "string" ? doc.metadata["source_id"] : undefined);
  return {
    ...doc,
    content,
    language: doc.language?.trim() || "pt-BR",
    status: doc.status ?? "active",
    updated_at: new Date().toISOString(),
    metadata: {
      ...doc.metadata,
      ...(sourceId ? { source_id: sourceId } : {}),
      document_version: doc.version,
      domain: doc.domain,
      version: doc.version,
      ...(doc.effective_date ? { effective_date: doc.effective_date } : {}),
    },
    ...(sourceId ? { source_id: sourceId } : {}),
  };
}

export async function ingestKnowledgeDocument(
  doc: KnowledgeDocument,
  opts?: IngestOptions,
): Promise<IngestResult> {
  assertDocument(doc);
  const store = await ensureVectorStore();
  const onDuplicate = opts?.onDuplicate ?? "upsert";
  const existed = hasKnowledgeDocument(doc.document_id);
  if (existed && onDuplicate === "reject") {
    throw new RagError(RAG_ERROR.DUPLICATE_DOCUMENT, `duplicate:${doc.document_id}`);
  }

  if (existed) {
    const prev = getKnowledgeEntry(doc.document_id);
    if (prev && prev.document.version !== doc.version) {
      await store.upsertEntry({ ...prev.document, status: "superseded" }, prev.chunks);
    }
  }

  const normalized = normalizeDocument(doc);
  const provider = getEmbeddingProvider();
  const chunks = chunkDocument(normalized, {
    ...(opts?.chunkSize !== undefined ? { chunkSize: opts.chunkSize } : {}),
    ...(opts?.chunkOverlap !== undefined ? { chunkOverlap: opts.chunkOverlap } : {}),
  });

  for (const chunk of chunks) {
    const emb = await provider.embed(chunk.content);
    chunk.embedding = emb;
    chunk.embedding_ref = provider.embeddingRef(chunk.content);
    chunk.metadata = {
      ...(chunk.metadata ?? {}),
      source_id: normalized.source_id ?? normalized.metadata["source_id"] ?? null,
      document_id: normalized.document_id,
      chunk_id: chunk.chunk_id,
      kb_ref: normalized.metadata["kb_ref"] ?? null,
      section: normalized.metadata["section"] ?? null,
      document_version: normalized.version,
      domain: normalized.domain,
      version: normalized.version,
      trust_level: normalized.metadata["trust_level"] ?? "curated",
    };
  }

  if (normalized.source_id && typeof store.upsertSource === "function") {
    await store.upsertSource({
      source_id: normalized.source_id,
      name: String(normalized.metadata["source_name"] ?? normalized.source_id),
      domain: normalized.domain,
      type: String(normalized.source_type ?? "structured"),
      version: normalized.version,
      trust_level: String(normalized.metadata["trust_level"] ?? "curated"),
      status: "active",
    });
  }

  await store.upsertEntry(normalized, chunks);
  return {
    document_id: doc.document_id,
    chunk_count: chunks.length,
    upserted: existed,
  };
}

export async function ingestKnowledgeBatch(
  docs: KnowledgeDocument[],
  opts?: IngestOptions,
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const doc of docs) {
    results.push(await ingestKnowledgeDocument(doc, opts));
  }
  return results;
}

/** Load from registered source adapter then ingest. */
export async function ingestFromSource(
  sourceId: string,
  opts?: IngestOptions,
): Promise<IngestResult[]> {
  try {
    const adapter = requireSourceAdapter(sourceId);
    const docs = await adapter.loadDocuments();
    return ingestKnowledgeBatch(docs, opts);
  } catch (e) {
    if (e instanceof RagError && e.code === RAG_ERROR.SOURCE_INVALID) throw e;
    if (e instanceof RagError && e.code === RAG_ERROR.UNKNOWN_SOURCE) {
      throw new RagError(RAG_ERROR.SOURCE_INVALID, `RAG_SOURCE_INVALID: ${sourceId}`);
    }
    throw new RagError(
      RAG_ERROR.SOURCE_INVALID,
      `RAG_SOURCE_INVALID: ${sourceId}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Seed all production curated sources into the active VectorStore (idempotent upserts).
 */
export async function seedProductionCorpus(
  opts?: IngestOptions & { report?: boolean },
): Promise<IngestResult[] | SeedCorpusReport> {
  const { listConnectedSourceIds } = await import("@/ai/rag/sources/production");
  const { registerAllKnowledgeSources } = await import("@/ai/rag/sources");
  registerAllKnowledgeSources({ force: true });

  let store;
  try {
    store = await ensureVectorStore();
  } catch (e) {
    const report: SeedCorpusReport = {
      ok: false,
      store_id: "none",
      sources: 0,
      documents: 0,
      chunks: 0,
      results: [],
      error: e instanceof Error ? e.message : String(e),
    };
    if (opts?.report) return report;
    throw e;
  }

  const sourceIds = listConnectedSourceIds();
  const all: IngestResult[] = [];
  try {
    for (const id of sourceIds) {
      all.push(...(await ingestFromSource(id, opts)));
    }
  } catch (e) {
    const report: SeedCorpusReport = {
      ok: false,
      store_id: store.id,
      sources: sourceIds.length,
      documents: all.length,
      chunks: all.reduce((n, r) => n + r.chunk_count, 0),
      results: all,
      error: e instanceof Error ? e.message : String(e),
    };
    if (opts?.report) return report;
    throw e;
  }

  const report: SeedCorpusReport = {
    ok: true,
    store_id: store.id,
    sources: sourceIds.length,
    documents: all.length,
    chunks: all.reduce((n, r) => n + r.chunk_count, 0),
    results: all,
  };

  if (opts?.report) return report;
  return all;
}

/** Expected minimum curated document count for readiness. */
export function expectedCorpusDocumentMin(): number {
  return Math.max(1, Math.floor(PRODUCT_KNOWLEDGE_CORPUS.length * 0.8));
}

/**
 * Ensure corpus is seeded when store is empty (production bootstrap).
 * Returns seed report or null if already sufficient.
 */
export async function ensureCorpusSeeded(): Promise<SeedCorpusReport | null> {
  const store = await ensureVectorStore();
  const size = typeof store.size === "function" ? await store.size() : 0;
  const min = expectedCorpusDocumentMin();
  if (size >= min) {
    return {
      ok: true,
      store_id: store.id,
      sources: 0,
      documents: size,
      chunks: 0,
      results: [],
    };
  }
  const out = await seedProductionCorpus({ report: true, onDuplicate: "upsert" });
  return out as SeedCorpusReport;
}

/** Re-export active store helper for diagnostics. */
export { getActiveVectorStore };
