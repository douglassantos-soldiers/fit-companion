/**
 * Provider registry — Agents must not import adapters directly.
 * FASE 22.5 — getProvider("mock") in production throws ProductionMockProviderError.
 */

import { AnthropicProvider } from "@/ai/providers/anthropic";
import { GoogleProvider } from "@/ai/providers/google";
import { getMockAIProvider, MockAIProvider } from "@/ai/providers/mock";
import { OpenAIProvider } from "@/ai/providers/openai";
import { ProductionMockProviderError } from "@/ai/providers/errors";
import type { AIProvider, AIProviderId } from "@/ai/providers/types";
import { resolveLlmEnvironment } from "@/ai/gateway/runtime/env";

const openai = new OpenAIProvider();
const anthropic = new AnthropicProvider();
const google = new GoogleProvider();

const registry: Record<AIProviderId, AIProvider> = {
  mock: getMockAIProvider(),
  openai,
  anthropic,
  google,
};

export function getProvider(id: AIProviderId): AIProvider {
  if (id === "mock") {
    if (resolveLlmEnvironment() === "production") {
      throw new ProductionMockProviderError("production && provider === mock");
    }
    return getMockAIProvider();
  }
  return registry[id];
}

export function listProviderIds(): AIProviderId[] {
  return ["mock", "openai", "anthropic", "google"];
}

/** Test helper — inject custom mock instance. Prefer importing from @/ai/providers/mock in tests. */
export function setMockProviderForTests(provider: MockAIProvider): void {
  registry.mock = provider;
}

/** Test/DI — replace a real provider adapter (e.g. openai) for hardening tests. */
export function setProviderForTests(id: AIProviderId, provider: AIProvider): void {
  registry[id] = provider;
}

export function resetProviderRegistry(): void {
  registry.openai = openai;
  registry.anthropic = anthropic;
  registry.google = google;
  registry.mock = getMockAIProvider();
}
