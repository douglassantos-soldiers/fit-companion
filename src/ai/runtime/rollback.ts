/**
 * Rollback helpers — force deterministic_runtime without calling providers.
 */
import { getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";
import { getAiFeatureFlags, isLlmFeatureAllowed } from "@/ai/runtime/feature-flags";

/**
 * Effective runtime mode after kill-switches.
 * AI_FORCE_DETERMINISTIC=1 or AI_ENABLED=0 → deterministic.
 * AI_LLM_ENABLED=0 → deterministic even if mode/override is llm|hybrid.
 */
export function resolveEffectiveRuntimeMode(override?: AiRuntimeMode): AiRuntimeMode {
  const flags = getAiFeatureFlags();
  if (flags.force_deterministic || !flags.ai_enabled) return "deterministic";
  const base = override ?? getAiRuntimeMode();
  if (base === "deterministic") return "deterministic";
  if (!isLlmFeatureAllowed(base)) return "deterministic";
  return base;
}

export function forceDeterministicRuntime(): boolean {
  const flags = getAiFeatureFlags();
  return flags.force_deterministic || !flags.ai_enabled || !isLlmFeatureAllowed(getAiRuntimeMode());
}

/** Ops checklist triggers (documented; env-driven). */
export const ROLLBACK_TRIGGERS = [
  "llm_provider_failure",
  "unexpected_model_behavior",
  "cost_limit_exceeded",
  "evaluation_regression",
] as const;
