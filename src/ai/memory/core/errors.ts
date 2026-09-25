/**
 * Memory Layer — error codes (fail-closed).
 */

export const MEMORY_ERROR = {
  ANONYMOUS_DENIED: "anonymous_denied",
  INVALID_TRUSTED_USER: "invalid_trusted_user_id",
  INVALID_INPUT: "invalid_input",
  FORBIDDEN_SOURCE: "forbidden_source",
  SENSITIVE_KEY: "sensitive_key_denied",
  CONFLICTING_MEMORY: "conflicting_memory",
  NOT_FOUND: "memory_not_found",
  USER_MISMATCH: "user_mismatch",
  STORE_ERROR: "store_error",
} as const;

export type MemoryErrorCode = (typeof MEMORY_ERROR)[keyof typeof MEMORY_ERROR];

export class MemoryError extends Error {
  readonly code: MemoryErrorCode;
  constructor(code: MemoryErrorCode, message: string) {
    super(message);
    this.name = "MemoryError";
    this.code = code;
  }
}
