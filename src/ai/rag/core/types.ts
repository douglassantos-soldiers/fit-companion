/**
 * RAG core types — store entries and retrieve options.
 */

import type { KnowledgeChunk } from "@/ai/contracts/knowledge-chunk";
import type { KnowledgeCitation } from "@/ai/contracts/knowledge-citation";
import type { KnowledgeDocument, KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import type {
  KnowledgeRetrieval,
  KnowledgeRetrievalMode,
} from "@/ai/contracts/knowledge-retrieval";
import type { KnowledgeSource } from "@/ai/contracts/knowledge-source";

export type StoredKnowledgeEntry = {
  document: KnowledgeDocument;
  chunks: KnowledgeChunk[];
};

export type RetrieveKnowledgeOptions = {
  query: string;
  domains?: KnowledgeDomain[];
  metadata?: Record<string, string | number | boolean | null>;
  topK?: number;
  mode?: KnowledgeRetrievalMode;
  /** Prefer chunks whose metadata.kb_ref is in this list */
  kbRefs?: string[];
  /** Governance correlation only — never used as chunk filter. */
  audit?: {
    userId?: string;
    runId?: string;
    agentId?: string;
  };
};

export type IngestOptions = {
  /** If same document_id exists: upsert (default) or reject */
  onDuplicate?: "upsert" | "reject";
  chunkSize?: number;
  chunkOverlap?: number;
};

export type IngestResult = {
  document_id: string;
  chunk_count: number;
  upserted: boolean;
};

export type KnowledgeSourceAdapter = {
  source: KnowledgeSource;
  /** Real sources wire here later; production adapters return []. */
  loadDocuments: () => Promise<KnowledgeDocument[]>;
};

export type RetrieveKnowledgeResult = {
  retrieval: KnowledgeRetrieval;
  citations: KnowledgeCitation[];
};
