/**
 * Provider error helpers — recoverable vs non-recoverable.
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
