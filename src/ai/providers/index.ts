/**
 * AI Providers barrel — product code should prefer @/ai/gateway.
 * FASE 22.5 — Mock helpers are NOT re-exported here; import from @/ai/providers/mock in tests only.
 */

export type {
  AIError,
  AIErrorCode,
  AIMessage,
  AIProvider,
  AIProviderId,
  AIRequest,
  AIResponse,
  AIResult,
  AIUsage,
} from "@/ai/providers/types";
export {
  isRetryableAIError,
  makeAIError,
  ProductionMockProviderError,
  isProductionMockProviderError,
} from "@/ai/providers/errors";
export {
  getProvider,
  listProviderIds,
  resetProviderRegistry,
  setProviderForTests,
} from "@/ai/providers/registry";
export { OpenAIProvider } from "@/ai/providers/openai";
export { AnthropicProvider } from "@/ai/providers/anthropic";
export { GoogleProvider } from "@/ai/providers/google";
