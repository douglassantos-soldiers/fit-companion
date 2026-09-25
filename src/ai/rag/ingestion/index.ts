/**
 * Knowledge ingestion — document → chunk → embed → store.
 * Does not invent content; callers supply documents from real sources or fixtures.
 */

import type { KnowledgeDocument } from "@/ai/contracts/knowledge-document";
import { KNOWLEDGE_DOMAINS } from "@/ai/contracts/knowledge-document";
import { chunkDocument } from "@/ai/rag/chunking";
import { RAG_ERROR, RagError } from "@/ai/rag/core/errors";
import { requireSourceAdapter } from "@/ai/rag/core/registry";
import { hasKnowledgeDocument, upsertKnowledgeEntry } from "@/ai/rag/core/store";
import type { IngestOptions, IngestResult } from "@/ai/rag/core/types";
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

  const provider = getEmbeddingProvider();
  const chunks = chunkDocument(doc, {
    ...(opts?.chunkSize !== undefined ? { chunkSize: opts.chunkSize } : {}),
    ...(opts?.chunkOverlap !== undefined ? { chunkOverlap: opts.chunkOverlap } : {}),
  });

  for (const chunk of chunks) {
    const emb = await provider.embed(chunk.content);
    chunk.embedding = emb;
    chunk.embedding_ref = provider.embeddingRef(chunk.content);
  }

  const normalized: KnowledgeDocument = {
    ...doc,
    updated_at: new Date().toISOString(),
    metadata: { ...doc.metadata },
  };

  upsertKnowledgeEntry({ document: normalized, chunks });
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

/** Load from registered source adapter (production adapters return []). */
export async function ingestFromSource(
  sourceId: string,
  opts?: IngestOptions,
): Promise<IngestResult[]> {
  const adapter = requireSourceAdapter(sourceId);
  const docs = await adapter.loadDocuments();
  return ingestKnowledgeBatch(docs, opts);
}
