/**
 * Per-agent / skill AI model config (gateway-owned).
 */

import type { AIProviderId } from "@/ai/providers/types";
import { getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";

export type AgentAIConfig = {
  provider: AIProviderId;
  fallback_provider?: AIProviderId;
  model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  max_cost: number;
  system_prompt_version: string;
  prompt_id: string;
};

const DEFAULTS: AgentAIConfig = {
  provider: "openai",
  fallback_provider: "mock",
  model: "gpt-4o-mini",
  temperature: 0.2,
  max_tokens: 800,
  timeout_ms: 20_000,
  max_cost: 0.05,
  system_prompt_version: "1.0.0",
  prompt_id: "default",
};

const AGENT_CONFIG: Record<string, Partial<AgentAIConfig>> = {
  specialist_training: {
    provider: "openai",
    fallback_provider: "mock",
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 900,
    timeout_ms: 20_000,
    max_cost: 0.05,
    system_prompt_version: "1.0.0",
    prompt_id: "specialist_training.v1",
  },
};

function resolvePrimaryProvider(): AIProviderId {
  const env = (process.env["AI_PRIMARY_PROVIDER"] ?? "").trim().toLowerCase();
  if (env === "mock" || env === "openai" || env === "anthropic" || env === "google") {
    return env;
  }
  return DEFAULTS.provider;
}

function resolveFallbackProvider(): AIProviderId | undefined {
  const env = (process.env["AI_FALLBACK_PROVIDER"] ?? "").trim().toLowerCase();
  if (env === "mock" || env === "openai" || env === "anthropic" || env === "google") {
    return env;
  }
  return DEFAULTS.fallback_provider;
}

export function getAgentAIConfig(agentId: string): AgentAIConfig {
  const override = AGENT_CONFIG[agentId] ?? {};
  const primary = resolvePrimaryProvider();
  const fallback = resolveFallbackProvider();
  return {
    ...DEFAULTS,
    ...override,
    provider: primary,
    ...(fallback ? { fallback_provider: fallback } : {}),
  };
}

export function getGatewayRuntimeSnapshot(): {
  mode: AiRuntimeMode;
  primary: AIProviderId;
  fallback?: AIProviderId;
} {
  const mode = getAiRuntimeMode();
  const primary = resolvePrimaryProvider();
  const fallback = resolveFallbackProvider();
  return {
    mode,
    primary,
    ...(fallback ? { fallback } : {}),
  };
}
