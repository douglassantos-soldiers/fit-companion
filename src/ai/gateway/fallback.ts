/**
 * Provider fallback chain: primary → secondary → safe failure.
 */

import { makeAIError } from "@/ai/providers/errors";
import { getProvider } from "@/ai/providers/registry";
import type { AIProviderId, AIRequest, AIResult } from "@/ai/providers/types";
import { withRetry } from "@/ai/gateway/retry";

export type FallbackTrace = {
  provider: AIProviderId;
  ok: boolean;
  code?: string;
  attempts: number;
};

export async function generateWithFallback(
  req: AIRequest,
  primary: AIProviderId,
  secondary?: AIProviderId,
): Promise<{ result: AIResult; trace: FallbackTrace[] }> {
  const chain: AIProviderId[] = [primary];
  if (secondary && secondary !== primary) chain.push(secondary);

  const trace: FallbackTrace[] = [];

  for (const providerId of chain) {
    const provider = getProvider(providerId);
    const { result, attempts } = await withRetry(() =>
      provider.generate({ ...req, provider: providerId }),
    );
    trace.push({
      provider: providerId,
      ok: result.ok,
      ...(result.ok ? {} : { code: result.code }),
      attempts: attempts.length,
    });
    if (result.ok) return { result, trace };
    // Do not fallback on auth / invalid_request / safety / cost_limit
    if (
      !result.ok &&
      (result.code === "unauthorized" ||
        result.code === "invalid_request" ||
        result.code === "safety_rejection" ||
        result.code === "cost_limit" ||
        result.code === "invalid_structured_output")
    ) {
      return { result, trace };
    }
  }

  return {
    result: makeAIError("upstream", "all_providers_failed", {
      provider: primary,
      ...(req.model ? { model: req.model } : {}),
    }),
    trace,
  };
}
