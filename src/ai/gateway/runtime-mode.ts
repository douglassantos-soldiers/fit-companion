/**
 * AI runtime mode — production default remains deterministic until env is set.
 */

export type AiRuntimeMode = "deterministic" | "llm" | "hybrid";

export function getAiRuntimeMode(): AiRuntimeMode {
  const raw = (process.env["AI_RUNTIME_MODE"] ?? "deterministic").trim().toLowerCase();
  if (raw === "llm" || raw === "hybrid" || raw === "deterministic") return raw;
  return "deterministic";
}

export function isLlmPathEnabled(mode: AiRuntimeMode = getAiRuntimeMode()): boolean {
  return mode === "llm" || mode === "hybrid";
}
