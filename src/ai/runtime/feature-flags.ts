/**
 * AI feature flags / kill-switches (server-side env only).
 * FASE 22.11 — canonical AI_* + aliases (AI_GLOBAL_ENABLED, RAG_ENABLED, …).
 * Defaults are production-safe: AI on; LLM only when runtime mode is hybrid|llm
 * unless AI_LLM_ENABLED / LLM_ENABLED is explicitly set.
 * Never trust client-sent flags — only process.env.
 */

import { getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";

function envExplicitBool(name: string): boolean | null {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return null;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return null;
}

function envBool(name: string, defaultValue: boolean): boolean {
  const e = envExplicitBool(name);
  return e == null ? defaultValue : e;
}

/**
 * First explicitly set env wins; otherwise default.
 * Used for canonical + alias pairs (FASE 22.11).
 */
export function envBoolAny(names: string[], defaultValue: boolean): boolean {
  for (const name of names) {
    const e = envExplicitBool(name);
    if (e != null) return e;
  }
  return defaultValue;
}

/** Which env key supplied an explicit value (for tests / audit). */
export function resolveFlagSource(names: string[]): string | null {
  for (const name of names) {
    if (envExplicitBool(name) != null) return name;
  }
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

const GLOBAL_KEYS = ["AI_GLOBAL_ENABLED", "AI_ENABLED"] as const;
const LLM_KEYS = ["AI_LLM_ENABLED", "LLM_ENABLED"] as const;
const RAG_KEYS = ["AI_RAG_ENABLED", "RAG_ENABLED"] as const;
const SPECIALISTS_KEYS = ["AI_SPECIALISTS_ENABLED", "SPECIALISTS_ENABLED"] as const;
const MEMORY_KEYS = ["AI_MEMORY_ENABLED", "MEMORY_ENABLED"] as const;
const LEARNING_KEYS = ["AI_LEARNING_ENABLED", "LEARNING_ENABLED"] as const;

export function isAiGlobalEnabled(): boolean {
  return envBoolAny([...GLOBAL_KEYS], true);
}

/** LLM allowed for a desired mode (respects explicit AI_LLM_ENABLED or alias LLM_ENABLED). */
export function isLlmFeatureAllowed(desiredMode?: AiRuntimeMode): boolean {
  const ai_enabled = isAiGlobalEnabled();
  const force = envBool("AI_FORCE_DETERMINISTIC", false);
  if (!ai_enabled || force) return false;
  const explicit =
    envExplicitBool("AI_LLM_ENABLED") ?? envExplicitBool("LLM_ENABLED");
  if (explicit != null) return explicit;
  const m = desiredMode ?? getAiRuntimeMode();
  return m === "llm" || m === "hybrid";
}

export function getAiFeatureFlags(): AiFeatureFlags {
  const mode = getAiRuntimeMode();
  const ai_enabled = isAiGlobalEnabled();
  return {
    ai_enabled,
    llm_enabled: isLlmFeatureAllowed(mode),
    rag_enabled: envBoolAny([...RAG_KEYS], true),
    specialists_enabled: envBoolAny([...SPECIALISTS_KEYS], true),
    memory_enabled: envBoolAny([...MEMORY_KEYS], true),
    learning_enabled: envBoolAny([...LEARNING_KEYS], true),
    force_deterministic: envBool("AI_FORCE_DETERMINISTIC", false),
  };
}

/**
 * Prove flags come only from process.env (server-authoritative).
 * Client payloads must never be passed here.
 */
export function assertServerAuthoritativeFlags(opts?: {
  /** Forbidden: any client-supplied flag bag */
  clientFlags?: unknown;
}): { ok: true; sources: Record<string, string | null> } {
  if (opts?.clientFlags != null) {
    throw new Error("CLIENT_FLAGS_FORBIDDEN");
  }
  return {
    ok: true,
    sources: {
      ai_enabled: resolveFlagSource([...GLOBAL_KEYS]),
      llm_enabled: resolveFlagSource([...LLM_KEYS]),
      rag_enabled: resolveFlagSource([...RAG_KEYS]),
      specialists_enabled: resolveFlagSource([...SPECIALISTS_KEYS]),
      memory_enabled: resolveFlagSource([...MEMORY_KEYS]),
      learning_enabled: resolveFlagSource([...LEARNING_KEYS]),
      force_deterministic: resolveFlagSource(["AI_FORCE_DETERMINISTIC"]),
    },
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

/** FASE 22.10 — when true, rate/cost enforcement is skipped (ops escape hatch). */
export function isAiRateLimitDisabledFlag(): boolean {
  return envBool("AI_RL_DISABLED", false);
}

export const AI_KILL_SWITCH_ENV_KEYS = {
  global: GLOBAL_KEYS,
  llm: LLM_KEYS,
  rag: RAG_KEYS,
  specialists: SPECIALISTS_KEYS,
  memory: MEMORY_KEYS,
  learning: LEARNING_KEYS,
  force: ["AI_FORCE_DETERMINISTIC"] as const,
} as const;
