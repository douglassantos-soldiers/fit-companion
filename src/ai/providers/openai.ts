/**
 * OpenAI provider — fetch-based Chat Completions (server-only).
 * FASE 22.4 — cached_tokens + actual_cost when available.
 */

import { makeAIError } from "@/ai/providers/errors";
import type { AIProvider, AIRequest, AIResult, AIUsage } from "@/ai/providers/types";

const DEFAULT_MODEL = "gpt-4o-mini";

/** Rough USD / 1M tokens (estimate only). */
const COST_PER_M: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
};

function roughTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;

  countTokens(text: string): number {
    return roughTokens(text);
  }

  estimateCost(usage: AIUsage, model = DEFAULT_MODEL): number {
    const rates = COST_PER_M[model] ?? COST_PER_M["gpt-4o-mini"]!;
    const cost =
      (usage.input_tokens / 1_000_000) * rates.in + (usage.output_tokens / 1_000_000) * rates.out;
    return Math.round(cost * 100000) / 100000;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    const key = process.env["OPENAI_API_KEY"]?.trim();
    if (!key) return { ok: false, detail: "OPENAI_API_KEY_missing" };
    return { ok: true, detail: "configured" };
  }

  async stream(): Promise<ReturnType<typeof makeAIError>> {
    return makeAIError("not_implemented", "openai_stream_not_implemented", { provider: "openai" });
  }

  async generate(req: AIRequest): Promise<AIResult> {
    const started = Date.now();
    const model = req.model ?? process.env["AI_OPENAI_MODEL"]?.trim() ?? DEFAULT_MODEL;
    const key = process.env["OPENAI_API_KEY"]?.trim();
    if (!key) {
      return makeAIError("not_configured", "OPENAI_API_KEY_missing", {
        provider: "openai",
        model,
        latency_ms: Date.now() - started,
      });
    }

    const maxTokens = req.max_tokens ?? 800;
    const timeoutMs = req.timeout_ms ?? 20_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        temperature: req.temperature ?? 0.2,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      };
      if (req.json_mode) {
        body["response_format"] = { type: "json_object" };
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 401 || res.status === 403) {
        return makeAIError("unauthorized", `openai_http_${res.status}`, {
          provider: "openai",
          model,
          latency_ms: Date.now() - started,
        });
      }
      if (res.status === 429) {
        return makeAIError("rate_limit", "openai_rate_limit", {
          provider: "openai",
          model,
          latency_ms: Date.now() - started,
        });
      }
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 200);
        return makeAIError("upstream", `openai_http_${res.status}:${detail}`, {
          provider: "openai",
          model,
          latency_ms: Date.now() - started,
        });
      }

      const json = (await res.json()) as {
        id?: string;
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      const input_tokens =
        json.usage?.prompt_tokens ?? roughTokens(req.messages.map((m) => m.content).join(""));
      const output_tokens = json.usage?.completion_tokens ?? roughTokens(text);
      const cached = json.usage?.prompt_tokens_details?.cached_tokens;
      const estimated = this.estimateCost({ input_tokens, output_tokens }, model);
      const usage: AIUsage = {
        input_tokens,
        output_tokens,
        ...(typeof cached === "number" ? { cached_tokens: cached } : {}),
        estimated_cost: estimated,
        actual_cost: null,
      };

      if (req.max_cost != null && (usage.estimated_cost ?? 0) > req.max_cost) {
        return makeAIError("cost_limit", "openai_cost_limit", {
          provider: "openai",
          model,
          usage,
          latency_ms: Date.now() - started,
        });
      }

      return {
        ok: true,
        provider: "openai",
        model,
        text,
        usage,
        latency_ms: Date.now() - started,
        ...(json.id ? { request_id: json.id } : {}),
        ...(json.choices?.[0]?.finish_reason
          ? { finish_reason: json.choices[0].finish_reason }
          : {}),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.toLowerCase().includes("abort") ? "timeout" : "upstream";
      return makeAIError(code, msg.slice(0, 200), {
        provider: "openai",
        model,
        latency_ms: Date.now() - started,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
