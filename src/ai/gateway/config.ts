/**
 * Per-agent / skill AI model config (gateway-owned).
 * FASE 22.4 — no mock fallback by default; production forbids mock.
 */

import type { AIProviderId } from "@/ai/providers/types";
import { getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";
import {
  resolveFallbackProvider,
  resolveLlmEnvironment,
  resolvePrimaryProvider,
} from "@/ai/gateway/runtime/env";

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
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 900,
    timeout_ms: 20_000,
    max_cost: 0.05,
    system_prompt_version: "1.0.0",
    prompt_id: "specialist_training.v1",
  },
  /** FASE 23.3 — meal suggestions (non-Decision); vision uses gpt-4o-class model */
  meal_ai: {
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.2,
    max_tokens: 500,
    timeout_ms: 25_000,
    max_cost: 0.08,
    system_prompt_version: "1.0.0",
    prompt_id: "meal_ai.v1",
  },
  /** Legacy coach provider adapter — Gateway only */
  coach_legacy_provider: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 800,
    timeout_ms: 20_000,
    max_cost: 0.05,
    system_prompt_version: "1.0.0",
    prompt_id: "coach_legacy.v1",
  },
};

export function getAgentAIConfig(agentId: string): AgentAIConfig {
  const override = AGENT_CONFIG[agentId] ?? {};
  const env = resolveLlmEnvironment();
  const primary = resolvePrimaryProvider(env);
  const fallback = resolveFallbackProvider(env);

  const { fallback_provider: _ignored, ...overrideRest } = override;
  return {
    ...DEFAULTS,
    ...overrideRest,
    provider: primary,
    ...(fallback && fallback !== primary ? { fallback_provider: fallback } : {}),
  };
}

export function getGatewayRuntimeSnapshot(): {
  mode: AiRuntimeMode;
  environment: ReturnType<typeof resolveLlmEnvironment>;
  primary: AIProviderId;
  fallback?: AIProviderId;
} {
  const mode = getAiRuntimeMode();
  const environment = resolveLlmEnvironment();
  const primary = resolvePrimaryProvider(environment);
  const fallback = resolveFallbackProvider(environment);
  return {
    mode,
    environment,
    primary,
    ...(fallback ? { fallback } : {}),
  };
}
