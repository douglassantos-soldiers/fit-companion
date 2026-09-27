/**
 * Gateway retry — only recoverable errors; never auth/safety/invalid_proposal.
 */

import { isRetryableAIError } from "@/ai/providers/errors";
import type { AIError, AIResult } from "@/ai/providers/types";

export const MAX_RETRIES = 2;

export type RetryAttempt = {
  attempt: number;
  result: AIResult;
};

export async function withRetry(
  fn: () => Promise<AIResult>,
  opts?: { maxRetries?: number },
): Promise<{ result: AIResult; attempts: RetryAttempt[] }> {
  const max = opts?.maxRetries ?? MAX_RETRIES;
  const attempts: RetryAttempt[] = [];
  let last: AIResult | null = null;

  for (let attempt = 0; attempt <= max; attempt++) {
    const result = await fn();
    attempts.push({ attempt, result });
    last = result;
    if (result.ok) return { result, attempts };
    const err = result as AIError;
    if (!isRetryableAIError(err.code) || !err.retryable) {
      return { result, attempts };
    }
    if (attempt === max) break;
  }

  return { result: last!, attempts };
}
