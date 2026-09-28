/**
 * RAG — error codes (fail-closed where applicable).
 * FASE 22.2 — explicit production failure codes.
 */

export const RAG_ERROR = {
  INVALID_DOCUMENT: "invalid_document",
  DUPLICATE_DOCUMENT: "duplicate_document",
  UNKNOWN_SOURCE: "unknown_source",
  EMPTY_QUERY: "empty_query",
  INGEST_FAILED: "ingest_failed",
  UNKNOWN_DOMAIN: "unknown_domain",
  TIMEOUT: "retrieval_timeout",
  /** Production / supabase store unavailable — never silent memory fallback. */
  UNAVAILABLE: "RAG_UNAVAILABLE",
  /** Retrieval completed with zero hits. */
  EMPTY: "RAG_EMPTY",
  /** Hits present but evidence quality inadequate. */
  LOW_CONFIDENCE: "RAG_LOW_CONFIDENCE",
  /** Unknown or invalid knowledge source. */
  SOURCE_INVALID: "RAG_SOURCE_INVALID",
} as const;

export type RagErrorCode = (typeof RAG_ERROR)[keyof typeof RAG_ERROR];

export class RagError extends Error {
  readonly code: RagErrorCode;
  constructor(code: RagErrorCode, message: string) {
    super(message);
    this.name = "RagError";
    this.code = code;
  }
}
