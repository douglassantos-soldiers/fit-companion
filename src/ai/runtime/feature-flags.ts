/**
 * AI feature flags / kill-switches (server-side env only).
 * Defaults are production-safe: AI on; LLM only when runtime mode is hybrid|llm
 * unless AI_LLM_ENABLED is explicitly set.
 */

import { getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return defaultValue;
}

function envExplicitBool(name: string): boolean | null {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return null;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return null;
}

export type AiFeatureFlags = {
  ai_enabled: boolean;
  llm_enabled: boolean;
  rag_enabled: boolean;
  specialists_enabled: boolean;
  memory_enabled: boolean;
  learning_enabled: boolean;
  force_deterministic: boolean;
};

/** LLM allowed for a desired mode (respects explicit AI_LLM_ENABLED). */
export function isLlmFeatureAllowed(desiredMode?: AiRuntimeMode): boolean {
  const ai_enabled = envBool("AI_ENABLED", true);
  const force = envBool("AI_FORCE_DETERMINISTIC", false);
  if (!ai_enabled || force) return false;
  const explicit = envExplicitBool("AI_LLM_ENABLED");
  if (explicit != null) return explicit;
  const m = desiredMode ?? getAiRuntimeMode();
  return m === "llm" || m === "hybrid";
}

export function getAiFeatureFlags(): AiFeatureFlags {
  const mode = getAiRuntimeMode();
  return {
    ai_enabled: envBool("AI_ENABLED", true),
    llm_enabled: isLlmFeatureAllowed(mode),
    rag_enabled: envBool("AI_RAG_ENABLED", true),
    specialists_enabled: envBool("AI_SPECIALISTS_ENABLED", true),
    memory_enabled: envBool("AI_MEMORY_ENABLED", true),
    learning_enabled: envBool("AI_LEARNING_ENABLED", true),
    force_deterministic: envBool("AI_FORCE_DETERMINISTIC", false),
  };
}

export function isAiEnabled(): boolean {
  return getAiFeatureFlags().ai_enabled;
}

export function isRagEnabled(): boolean {
  const f = getAiFeatureFlags();
  return f.ai_enabled && f.rag_enabled;
}

export function isMemoryEnabled(): boolean {
  const f = getAiFeatureFlags();
  return f.ai_enabled && f.memory_enabled;
}

export function isLearningEnabled(): boolean {
  const f = getAiFeatureFlags();
  return f.ai_enabled && f.learning_enabled;
}

export function isSpecialistsEnabled(): boolean {
  const f = getAiFeatureFlags();
  return f.ai_enabled && f.specialists_enabled;
}
