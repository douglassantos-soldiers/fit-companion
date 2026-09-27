/**
 * Google provider stub — interface ready; not activated in FASE 17.
 */

import { makeAIError } from "@/ai/providers/errors";
import type { AIProvider, AIRequest, AIResult, AIUsage } from "@/ai/providers/types";

export class GoogleProvider implements AIProvider {
  readonly id = "google" as const;

  countTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  estimateCost(usage: AIUsage): number {
    return Math.round(((usage.input_tokens + usage.output_tokens) / 1_000_000) * 0.5 * 10000) / 10000;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: false, detail: "google_provider_stub_fase17" };
  }

  async stream(): Promise<ReturnType<typeof makeAIError>> {
    return makeAIError("not_implemented", "google_stream_not_implemented", { provider: "google" });
  }

  async generate(req: AIRequest): Promise<AIResult> {
    return makeAIError("not_configured", "google_provider_stub_fase17", {
      provider: "google",
      model: req.model ?? "gemini",
    });
  }
}
