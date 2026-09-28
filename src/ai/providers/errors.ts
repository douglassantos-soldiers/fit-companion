/**
 * Provider error helpers — recoverable vs non-recoverable.
 * FASE 22.5 — ProductionMockProviderError hard-blocks mock in production.
 */

import type { AIError, AIErrorCode } from "@/ai/providers/types";

const RETRYABLE: ReadonlySet<AIErrorCode> = new Set(["rate_limit", "timeout", "upstream"]);

const NEVER_RETRY: ReadonlySet<AIErrorCode> = new Set([
  "unauthorized",
  "invalid_request",
  "invalid_structured_output",
  "safety_rejection",
  "cost_limit",
  "not_configured",
  "not_implemented",
]);

export function isRetryableAIError(code: AIErrorCode): boolean {
  if (NEVER_RETRY.has(code)) return false;
  return RETRYABLE.has(code);
}

export function makeAIError(
  code: AIErrorCode,
  message: string,
  extra?: Partial<Omit<AIError, "ok" | "code" | "message">>,
): AIError {
  const err: AIError = {
    ok: false,
    code,
    message,
    retryable: isRetryableAIError(code),
  };
  if (extra?.provider) err.provider = extra.provider;
  if (extra?.model) err.model = extra.model;
  if (extra?.latency_ms != null) err.latency_ms = extra.latency_ms;
  if (extra?.usage) err.usage = extra.usage;
  if (extra?.retryable != null) err.retryable = extra.retryable;
  return err;
}

/** Thrown when production code attempts to use the Mock LLM provider. */
export class ProductionMockProviderError extends Error {
  readonly code = "PRODUCTION_MOCK_FORBIDDEN" as const;
  constructor(message = "production && provider === mock") {
    super(message);
    this.name = "ProductionMockProviderError";
  }
}

export function isProductionMockProviderError(e: unknown): e is ProductionMockProviderError {
  return e instanceof ProductionMockProviderError;
}
