/**
 * Rollback helpers — force deterministic_runtime without calling providers.
 * FASE 22.11 — procedure constants aligned with docs/AI_KILL_SWITCH.md.
 */
import { getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";
import { getAiFeatureFlags, isLlmFeatureAllowed } from "@/ai/runtime/feature-flags";

/**
 * Effective runtime mode after kill-switches.
 * AI_FORCE_DETERMINISTIC=1 or AI_GLOBAL_ENABLED/AI_ENABLED=0 → deterministic.
 * AI_LLM_ENABLED/LLM_ENABLED=0 → deterministic even if mode/override is llm|hybrid.
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

/**
 * Ordered rollback procedure (env keys to set).
 * Prefer earlier steps; escalate only if needed.
 */
export const ROLLBACK_PROCEDURE = [
  {
    step: 1,
    action: "force_deterministic",
    env: { AI_FORCE_DETERMINISTIC: "1" },
    effect: "invokeAI skips providers; effective mode deterministic",
  },
  {
    step: 2,
    action: "disable_llm",
    env: { AI_LLM_ENABLED: "0", AI_RUNTIME_MODE: "deterministic" },
    effect: "LLM path off even if FORCE cleared; specialists use deterministic runtime",
  },
  {
    step: 3,
    action: "disable_components",
    env: {
      AI_SPECIALISTS_ENABLED: "0",
      AI_RAG_ENABLED: "0",
      AI_MEMORY_ENABLED: "0",
      AI_LEARNING_ENABLED: "0",
    },
    effect: "component kill without full AI off; Decision Engine untouched",
  },
  {
    step: 4,
    action: "global_off",
    env: { AI_GLOBAL_ENABLED: "0" },
    effect: "all AI helpers false; Identity/Context/Safety/Decision/LP still work",
  },
] as const;
