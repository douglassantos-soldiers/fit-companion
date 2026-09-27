/**
 * KnowledgeCitation — source tracking for any RAG-dependent answer.
 * Format: source → document → section → chunk → retrieval_id (+ version).
 */

export type KnowledgeCitation = {
  citation_id: string;
  document_id: string;
  chunk_id: string;
  source_id?: string;
  title: string;
  uri?: string;
  score: number;
  excerpt: string;
  /** Full provenance chain (FASE 16). */
  source?: string;
  document?: string;
  section?: string;
  chunk?: string;
  retrieval_id?: string;
  document_version?: string;
  effective_date?: string;
};
