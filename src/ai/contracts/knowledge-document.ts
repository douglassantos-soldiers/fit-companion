/**
 * KnowledgeDocument — RAG corpus unit (general/product knowledge).
 * RAG provides knowledge, not authority over decisions or critical state.
 * Distinct from UserMemory (per-user history/context).
 */

export type KnowledgeDomain =
  | "exercise"
  | "nutrition"
  | "recovery"
  | "sleep"
  | "behavior"
  | "performance"
  | "supplementation"
  | "products"
  | "coaching";

export const KNOWLEDGE_DOMAINS: readonly KnowledgeDomain[] = [
  "exercise",
  "nutrition",
  "recovery",
  "sleep",
  "behavior",
  "performance",
  "supplementation",
  "products",
  "coaching",
] as const;

/** Family of provenance (product / catalog / external). */
export type KnowledgeDocumentSource =
  "internal_docs" | "catalog" | "content_os" | "external" | "unknown";

/** Granular ingest format / origin kind. */
export type KnowledgeSourceType =
  "fixture" | "markdown" | "catalog_row" | "url" | "api" | "manual" | "unknown";

export type KnowledgeDocument = {
  document_id: string;
  title: string;
  domain: KnowledgeDomain;
  source: KnowledgeDocumentSource;
  source_type: KnowledgeSourceType;
  version: string;
  language: string;
  content: string;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
  uri?: string;
  tags?: string[];
};
