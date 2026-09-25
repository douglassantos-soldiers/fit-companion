/**
 * KnowledgeCitation — source tracking for any RAG-dependent answer.
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
};
