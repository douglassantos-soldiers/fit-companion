/**
 * Anthropic provider stub — interface ready; not activated in FASE 17.
 */

import { makeAIError } from "@/ai/providers/errors";
import type { AIProvider, AIRequest, AIResult, AIUsage } from "@/ai/providers/types";

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;

  countTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  estimateCost(usage: AIUsage): number {
    return Math.round(((usage.input_tokens + usage.output_tokens) / 1_000_000) * 3 * 10000) / 10000;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    const key = process.env["ANTHROPIC_API_KEY"]?.trim();
    return key
      ? { ok: false, detail: "stub_not_activated" }
      : { ok: false, detail: "ANTHROPIC_API_KEY_missing" };
  }

  async stream(): Promise<ReturnType<typeof makeAIError>> {
    return makeAIError("not_implemented", "anthropic_stream_not_implemented", {
      provider: "anthropic",
    });
  }

  async generate(req: AIRequest): Promise<AIResult> {
    return makeAIError("not_configured", "anthropic_provider_stub_fase17", {
      provider: "anthropic",
      model: req.model ?? "claude-sonnet",
    });
  }
}
