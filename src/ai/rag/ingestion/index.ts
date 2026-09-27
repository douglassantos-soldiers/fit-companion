/**
 * Knowledge ingestion — SOURCE → FETCH → VALIDATE → NORMALIZE → CHUNK → METADATA → EMBED → INDEX → VERSION
 */

import type { KnowledgeDocument } from "@/ai/contracts/knowledge-document";
import { KNOWLEDGE_DOMAINS } from "@/ai/contracts/knowledge-document";
import { chunkDocument } from "@/ai/rag/chunking";
import { RAG_ERROR, RagError } from "@/ai/rag/core/errors";
import { requireSourceAdapter } from "@/ai/rag/core/registry";
import { getKnowledgeEntry, hasKnowledgeDocument } from "@/ai/rag/core/store";
import type { IngestOptions, IngestResult } from "@/ai/rag/core/types";
import { getVectorStore } from "@/ai/rag/core/vector-store";
import { getEmbeddingProvider } from "@/ai/rag/embeddings";

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
  const onDuplicate = opts?.onDuplicate ?? "upsert";
  const existed = hasKnowledgeDocument(doc.document_id);
  if (existed && onDuplicate === "reject") {
    throw new RagError(RAG_ERROR.DUPLICATE_DOCUMENT, `duplicate:${doc.document_id}`);
  }

  // Version: mark previous same id as superseded when version changes
  if (existed) {
    const prev = getKnowledgeEntry(doc.document_id);
    if (prev && prev.document.version !== doc.version) {
      await getVectorStore().upsertEntry(
        { ...prev.document, status: "superseded" },
        prev.chunks,
      );
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
      kb_ref: normalized.metadata["kb_ref"] ?? null,
      section: normalized.metadata["section"] ?? null,
      document_version: normalized.version,
      trust_level: normalized.metadata["trust_level"] ?? "curated",
    };
  }

  await getVectorStore().upsertEntry(normalized, chunks);
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
  const adapter = requireSourceAdapter(sourceId);
  const docs = await adapter.loadDocuments();
  return ingestKnowledgeBatch(docs, opts);
}

/** Seed all production curated sources into the active VectorStore. */
export async function seedProductionCorpus(opts?: IngestOptions): Promise<IngestResult[]> {
  const { listConnectedSourceIds } = await import("@/ai/rag/sources/production");
  const { registerAllKnowledgeSources } = await import("@/ai/rag/sources");
  registerAllKnowledgeSources({ force: true });
  const all: IngestResult[] = [];
  for (const id of listConnectedSourceIds()) {
    all.push(...(await ingestFromSource(id, opts)));
  }
  return all;
}
