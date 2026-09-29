/**
 * LLM provider adapter — FASE 23.3: routes through AI Gateway (no direct fetch bypass).
 * No business rules here. Meal/Coach product paths that need Decisions use Decision Engine separately.
 */
import { invokeAI } from "@/ai/gateway/gateway";
import { getAiRuntimeMode } from "@/ai/gateway/runtime-mode";
import { getAiFeatureFlags } from "@/ai/runtime/feature-flags";
import { resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";

export type CoachProviderId = "chatgpt" | "claude";

export type ProviderMessage = { role: "user" | "assistant"; content: string };

export type ProviderRequest = {
  provider: CoachProviderId;
  system: string;
  messages: ProviderMessage[];
  maxTokens?: number;
};

export type ProviderResult =
  | { text: string; model: string; error?: undefined }
  | { text: ""; model: string; error: "not_configured" | "upstream" };

/**
 * @deprecated Prefer runCoachAgent → runProductionAiRuntime. This adapter remains
 * for legacy callers and always goes through invokeAI (kill switch / rate limit / audit).
 */
export async function callCoachProvider(req: ProviderRequest): Promise<ProviderResult> {
  const maxTokens = req.maxTokens ?? 800;
  const modelFallback = req.provider === "chatgpt" ? "gpt-4o" : "claude-sonnet-4-5";

  const flags = getAiFeatureFlags();
  if (!flags.ai_enabled || flags.force_deterministic) {
    return { text: "", model: modelFallback, error: "not_configured" };
  }

  let runtimeMode = resolveEffectiveRuntimeMode(getAiRuntimeMode());
  if (runtimeMode === "deterministic") {
    if (!flags.llm_enabled) {
      return { text: "", model: modelFallback, error: "not_configured" };
    }
    runtimeMode = "llm";
  }

  const userContent = req.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const res = await invokeAI({
    agentId: "coach_legacy_provider",
    userContent,
    runtimeMode,
    skipValidate: true,
    provider: req.provider === "chatgpt" ? "openai" : "anthropic",
    request: {
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: req.system },
        ...req.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    },
  });

  if (!res.ok) {
    const code = res.error.code;
    if (code === "not_configured" || code === "unauthorized") {
      return { text: "", model: res.model ?? modelFallback, error: "not_configured" };
    }
    return { text: "", model: res.model ?? modelFallback, error: "upstream" };
  }

  return {
    text: res.text.trim() || "Não consegui responder agora.",
    model: res.model || modelFallback,
  };
}
