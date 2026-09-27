/**
 * Provider registry — Agents must not import adapters directly.
 */

import { AnthropicProvider } from "@/ai/providers/anthropic";
import { GoogleProvider } from "@/ai/providers/google";
import { getMockAIProvider, MockAIProvider } from "@/ai/providers/mock";
import { OpenAIProvider } from "@/ai/providers/openai";
import type { AIProvider, AIProviderId } from "@/ai/providers/types";

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
  if (id === "mock") return getMockAIProvider();
  return registry[id];
}

export function listProviderIds(): AIProviderId[] {
  return ["mock", "openai", "anthropic", "google"];
}

/** Test helper — inject custom mock instance into registry path via getMockAIProvider. */
export function setMockProviderForTests(provider: MockAIProvider): void {
  registry.mock = provider;
}
