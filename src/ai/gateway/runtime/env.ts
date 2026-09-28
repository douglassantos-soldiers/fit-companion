/**
 * FASE 22.4/22.5 — LLM environment resolution.
 * PRODUCTION never allows mock as primary or fallback.
 */

import type { AIProviderId } from "@/ai/providers/types";
import { ProductionMockProviderError } from "@/ai/providers/errors";

export type LlmEnvironment = "development" | "test" | "production";

/**
 * Resolve LLM environment.
 * - AI_LLM_ENV overrides when set
 * - VITEST=true → test
 * - NODE_ENV=production → production
 * - else development
 */
export function resolveLlmEnvironment(): LlmEnvironment {
  const explicit = (process.env["AI_LLM_ENV"] ?? "").trim().toLowerCase();
  if (explicit === "production" || explicit === "prod") return "production";
  if (explicit === "test") return "test";
  if (explicit === "development" || explicit === "dev") return "development";

  if (process.env["VITEST"] === "true" || process.env["VITEST"] === "1") return "test";
  if ((process.env["NODE_ENV"] ?? "").toLowerCase() === "production") return "production";
  return "development";
}

export function isLlmProduction(env: LlmEnvironment = resolveLlmEnvironment()): boolean {
  return env === "production";
}

function parseProviderId(raw: string): AIProviderId | null {
  const v = raw.trim().toLowerCase();
  if (v === "mock" || v === "openai" || v === "anthropic" || v === "google") return v;
  return null;
}

/**
 * Primary provider. Production forbids mock (throws ProductionMockProviderError).
 */
export function resolvePrimaryProvider(
  env: LlmEnvironment = resolveLlmEnvironment(),
): AIProviderId {
  const fromEnv = parseProviderId(process.env["AI_PRIMARY_PROVIDER"] ?? "");
  const primary = fromEnv ?? "openai";
  if (env === "production" && primary === "mock") {
    throw new ProductionMockProviderError(
      "AI_PRIMARY_PROVIDER=mock is forbidden in production",
    );
  }
  return primary;
}

/**
 * Fallback provider. Production never returns mock — omits or uses real only.
 * Default: undefined (no mock fallback).
 */
export function resolveFallbackProvider(
  env: LlmEnvironment = resolveLlmEnvironment(),
): AIProviderId | undefined {
  const raw = (process.env["AI_FALLBACK_PROVIDER"] ?? "").trim();
  if (!raw) return undefined;
  const id = parseProviderId(raw);
  if (!id) return undefined;
  if (env === "production" && id === "mock") {
    return undefined;
  }
  return id;
}

export function assertProviderAllowedInEnv(
  id: AIProviderId,
  env: LlmEnvironment = resolveLlmEnvironment(),
): void {
  if (env === "production" && id === "mock") {
    throw new ProductionMockProviderError("production && provider === mock");
  }
}
