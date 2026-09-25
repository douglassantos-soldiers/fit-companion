/**
 * In-memory knowledge store (versioned corpus for this phase).
 * Not User Memory. No DB access.
 */

import type { KnowledgeChunk } from "@/ai/contracts/knowledge-chunk";
import type { KnowledgeDocument, KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import type { StoredKnowledgeEntry } from "@/ai/rag/core/types";

const documents = new Map<string, StoredKnowledgeEntry>();

export function clearKnowledgeStore(): void {
  documents.clear();
}

export function upsertKnowledgeEntry(entry: StoredKnowledgeEntry): void {
  documents.set(entry.document.document_id, entry);
}

export function getKnowledgeEntry(documentId: string): StoredKnowledgeEntry | undefined {
  return documents.get(documentId);
}

export function hasKnowledgeDocument(documentId: string): boolean {
  return documents.has(documentId);
}

export function deleteKnowledgeDocument(documentId: string): boolean {
  return documents.delete(documentId);
}

export function listKnowledgeDocuments(domain?: KnowledgeDomain): KnowledgeDocument[] {
  const out: KnowledgeDocument[] = [];
  for (const entry of documents.values()) {
    if (domain && entry.document.domain !== domain) continue;
    out.push(entry.document);
  }
  return out;
}

export function listKnowledgeChunks(opts?: {
  domains?: KnowledgeDomain[];
  metadata?: Record<string, string | number | boolean | null>;
  kbRefs?: string[];
}): Array<{ document: KnowledgeDocument; chunk: KnowledgeChunk }> {
  const out: Array<{ document: KnowledgeDocument; chunk: KnowledgeChunk }> = [];
  const domains = opts?.domains;
  const metadata = opts?.metadata;
  const kbRefs = opts?.kbRefs;

  for (const entry of documents.values()) {
    if (domains && domains.length > 0 && !domains.includes(entry.document.domain)) {
      continue;
    }
    if (metadata) {
      let ok = true;
      for (const [k, v] of Object.entries(metadata)) {
        if (entry.document.metadata[k] !== v) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    for (const chunk of entry.chunks) {
      if (kbRefs && kbRefs.length > 0) {
        const ref = chunk.metadata?.["kb_ref"] ?? entry.document.metadata["kb_ref"];
        if (typeof ref !== "string" || !kbRefs.includes(ref)) continue;
      }
      out.push({ document: entry.document, chunk });
    }
  }
  return out;
}

export function knowledgeStoreSize(): number {
  return documents.size;
}
