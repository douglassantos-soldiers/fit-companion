/**
 * KnowledgeDocument — RAG corpus unit (general/product knowledge).
 * RAG provides knowledge, not authority over decisions or critical state.
 * Distinct from UserMemory (per-user history/context).
 */

export type KnowledgeDomain =
  | "exercise"
  | "training"
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
  "training",
  "nutrition",
  "recovery",
  "sleep",
  "behavior",
  "performance",
  "supplementation",
  "products",
  "coaching",
] as const;

/** training ↔ exercise alias for retrieval filters. */
export function expandDomainFilter(domains?: KnowledgeDomain[]): KnowledgeDomain[] | undefined {
  if (!domains || domains.length === 0) return domains;
  const out = new Set<KnowledgeDomain>(domains);
  if (out.has("training")) out.add("exercise");
  if (out.has("exercise")) out.add("training");
  return [...out];
}

/** Family of provenance (product / catalog / external). */
export type KnowledgeDocumentSource =
  "internal_docs" | "catalog" | "content_os" | "external" | "unknown";

/** Granular ingest format / origin kind. */
export type KnowledgeSourceType =
  "fixture" | "markdown" | "catalog_row" | "url" | "api" | "manual" | "structured" | "unknown";

export type KnowledgeDocumentStatus = "active" | "superseded" | "draft";

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
  status?: KnowledgeDocumentStatus;
  effective_date?: string;
  expiration_date?: string | null;
  source_id?: string;
};
