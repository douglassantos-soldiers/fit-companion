/**
 * RAG — error codes (fail-closed where applicable).
 */

export const RAG_ERROR = {
  INVALID_DOCUMENT: "invalid_document",
  DUPLICATE_DOCUMENT: "duplicate_document",
  UNKNOWN_SOURCE: "unknown_source",
  EMPTY_QUERY: "empty_query",
  INGEST_FAILED: "ingest_failed",
  UNKNOWN_DOMAIN: "unknown_domain",
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
