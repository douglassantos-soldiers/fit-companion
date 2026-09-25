/**
 * KnowledgeRetrieval — audited retrieval run (query → scored hits).
 */

import type { KnowledgeDomain } from "./knowledge-document";

export type KnowledgeRetrievalMode = "semantic" | "keyword" | "hybrid";

export type KnowledgeRetrievalHit = {
  chunk_id: string;
  document_id: string;
  domain: KnowledgeDomain;
  score: number;
  semantic_score: number;
  keyword_score: number;
  title: string;
  excerpt: string;
  source_id?: string;
  uri?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type KnowledgeRetrieval = {
  retrieval_id: string;
  query: string;
  domain_filter?: KnowledgeDomain[];
  metadata_filter?: Record<string, string | number | boolean | null>;
  mode: KnowledgeRetrievalMode;
  hits: KnowledgeRetrievalHit[];
  latency_ms: number;
  created_at: string;
};
