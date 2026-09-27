/**
 * AI Providers barrel — FASE 17.
 * Prefer @/ai/gateway from Agents; do not call providers from UI.
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
export { isRetryableAIError, makeAIError } from "@/ai/providers/errors";
export { getProvider, listProviderIds } from "@/ai/providers/registry";
export { MockAIProvider, getMockAIProvider, resetMockAIProvider } from "@/ai/providers/mock";
export { OpenAIProvider } from "@/ai/providers/openai";
export { AnthropicProvider } from "@/ai/providers/anthropic";
export { GoogleProvider } from "@/ai/providers/google";
