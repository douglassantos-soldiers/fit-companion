/**
 * KnowledgeChunk — retrievable fragment of a KnowledgeDocument.
 * Used by RAG; citations inform agents but do not authorize actions.
 */

export type KnowledgeChunk = {
  chunk_id: string;
  document_id: string;
  ordinal: number;
  content: string;
  token_estimate?: number;
  embedding_ref?: string;
  /** In-process vector (local provider); not persisted to DB in this phase. */
  embedding?: number[];
  metadata?: Record<string, string | number | boolean | null>;
};
