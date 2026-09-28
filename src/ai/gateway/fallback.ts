/**
 * Provider fallback chain: primary → secondary → safe failure.
 * FASE 22.5 — ProductionMockProviderError; mock never in production chain.
 */

import {
  isProductionMockProviderError,
  makeAIError,
  ProductionMockProviderError,
} from "@/ai/providers/errors";
import { getProvider } from "@/ai/providers/registry";
import type { AIProviderId, AIRequest, AIResult } from "@/ai/providers/types";
import { withRetry } from "@/ai/gateway/retry";
import {
  canCallProvider,
  recordCircuitFailure,
  recordCircuitSuccess,
} from "@/ai/gateway/circuit-breaker";
import { assertProviderAllowedInEnv, resolveLlmEnvironment } from "@/ai/gateway/runtime/env";

export type FallbackTrace = {
  provider: AIProviderId;
  ok: boolean;
  code?: string;
  attempts: number;
  circuit_skipped?: boolean;
};

function sanitizeChain(primary: AIProviderId, secondary?: AIProviderId): AIProviderId[] {
  const env = resolveLlmEnvironment();
  const chain: AIProviderId[] = [];
  for (const id of [primary, secondary]) {
    if (!id) continue;
    if (chain.includes(id)) continue;
    if (env === "production" && id === "mock") continue;
    chain.push(id);
  }
  return chain;
}

export async function generateWithFallback(
  req: AIRequest,
  primary: AIProviderId,
  secondary?: AIProviderId,
): Promise<{ result: AIResult; trace: FallbackTrace[] }> {
  const env = resolveLlmEnvironment();
  try {
    assertProviderAllowedInEnv(primary, env);
  } catch (e) {
    if (isProductionMockProviderError(e) || e instanceof ProductionMockProviderError) {
      return {
        result: makeAIError("not_configured", e.message, {
          provider: primary,
          retryable: false,
        }),
        trace: [{ provider: primary, ok: false, code: "not_configured", attempts: 0 }],
      };
    }
    return {
      result: makeAIError(
        "not_configured",
        e instanceof Error ? e.message : "mock_forbidden_in_production",
        { provider: primary },
      ),
      trace: [{ provider: primary, ok: false, code: "not_configured", attempts: 0 }],
    };
  }

  const chain = sanitizeChain(primary, secondary);
  if (chain.length === 0) {
    return {
      result: makeAIError("not_configured", "no_allowed_providers", { provider: primary }),
      trace: [],
    };
  }

  const trace: FallbackTrace[] = [];
  let lastFailure: AIResult | null = null;

  for (const providerId of chain) {
    if (!canCallProvider(providerId)) {
      trace.push({
        provider: providerId,
        ok: false,
        code: "upstream",
        attempts: 0,
        circuit_skipped: true,
      });
      continue;
    }

    let provider;
    try {
      provider = getProvider(providerId);
    } catch (e) {
      if (isProductionMockProviderError(e)) {
        trace.push({
          provider: providerId,
          ok: false,
          code: "not_configured",
          attempts: 0,
        });
        lastFailure = makeAIError("not_configured", e.message, {
          provider: providerId,
          retryable: false,
        });
        continue;
      }
      throw e;
    }

    const { result, attempts } = await withRetry(() =>
      provider.generate({ ...req, provider: providerId }),
    );
    trace.push({
      provider: providerId,
      ok: result.ok,
      ...(result.ok ? {} : { code: result.code }),
      attempts: attempts.length,
    });

    if (result.ok) {
      recordCircuitSuccess(providerId);
      return { result, trace };
    }

    lastFailure = result;
    recordCircuitFailure(providerId);

    if (
      result.code === "unauthorized" ||
      result.code === "invalid_request" ||
      result.code === "safety_rejection" ||
      result.code === "cost_limit" ||
      result.code === "invalid_structured_output"
    ) {
      return { result, trace };
    }
  }

  return {
    result:
      lastFailure ??
      makeAIError("upstream", "all_providers_failed", {
        provider: primary,
        ...(req.model ? { model: req.model } : {}),
      }),
    trace,
  };
}
