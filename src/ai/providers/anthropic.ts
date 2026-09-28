/**
 * Anthropic Messages API — fetch-based (server-only).
 * FASE 22.4 — real fallback provider B; Agents never import this module directly.
 */

import { makeAIError } from "@/ai/providers/errors";
import type { AIProvider, AIRequest, AIResult, AIUsage } from "@/ai/providers/types";

const DEFAULT_MODEL = "claude-3-5-haiku-latest";

/** Rough USD / 1M tokens (estimate only). */
const COST_PER_M: Record<string, { in: number; out: number }> = {
  "claude-3-5-haiku-latest": { in: 0.8, out: 4 },
  "claude-3-5-sonnet-latest": { in: 3, out: 15 },
  "claude-sonnet-4-20250514": { in: 3, out: 15 },
};

function roughTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;

  countTokens(text: string): number {
    return roughTokens(text);
  }

  estimateCost(usage: AIUsage, model = DEFAULT_MODEL): number {
    const rates = COST_PER_M[model] ?? COST_PER_M["claude-3-5-haiku-latest"]!;
    const cost =
      (usage.input_tokens / 1_000_000) * rates.in + (usage.output_tokens / 1_000_000) * rates.out;
    return Math.round(cost * 100000) / 100000;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    const key = process.env["ANTHROPIC_API_KEY"]?.trim();
    if (!key) return { ok: false, detail: "ANTHROPIC_API_KEY_missing" };
    return { ok: true, detail: "configured" };
  }

  async stream(): Promise<ReturnType<typeof makeAIError>> {
    return makeAIError("not_implemented", "anthropic_stream_not_implemented", {
      provider: "anthropic",
    });
  }

  async generate(req: AIRequest): Promise<AIResult> {
    const started = Date.now();
    const model = req.model ?? process.env["AI_ANTHROPIC_MODEL"]?.trim() ?? DEFAULT_MODEL;
    const key = process.env["ANTHROPIC_API_KEY"]?.trim();
    if (!key) {
      return makeAIError("not_configured", "ANTHROPIC_API_KEY_missing", {
        provider: "anthropic",
        model,
        latency_ms: Date.now() - started,
      });
    }

    const maxTokens = req.max_tokens ?? 800;
    const timeoutMs = req.timeout_ms ?? 20_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const systemParts: string[] = [];
      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const m of req.messages) {
        if (m.role === "system") {
          systemParts.push(m.content);
        } else if (m.role === "user" || m.role === "assistant") {
          messages.push({ role: m.role, content: m.content });
        }
      }
      if (messages.length === 0) {
        messages.push({ role: "user", content: "(empty)" });
      }

      const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        temperature: req.temperature ?? 0.2,
        messages,
      };
      if (systemParts.length) body["system"] = systemParts.join("\n\n");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 401 || res.status === 403) {
        return makeAIError("unauthorized", `anthropic_http_${res.status}`, {
          provider: "anthropic",
          model,
          latency_ms: Date.now() - started,
        });
      }
      if (res.status === 429) {
        return makeAIError("rate_limit", "anthropic_rate_limit", {
          provider: "anthropic",
          model,
          latency_ms: Date.now() - started,
        });
      }
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 200);
        return makeAIError("upstream", `anthropic_http_${res.status}:${detail}`, {
          provider: "anthropic",
          model,
          latency_ms: Date.now() - started,
        });
      }

      const json = (await res.json()) as {
        id?: string;
        content?: Array<{ type?: string; text?: string }>;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_read_input_tokens?: number;
        };
        stop_reason?: string;
      };

      const text =
        (json.content ?? [])
          .filter((c) => c.type === "text" && typeof c.text === "string")
          .map((c) => c.text!)
          .join("")
          .trim() || "";

      const input_tokens =
        json.usage?.input_tokens ??
        roughTokens(req.messages.map((m) => m.content).join(""));
      const output_tokens = json.usage?.output_tokens ?? roughTokens(text);
      const cached =
        typeof json.usage?.cache_read_input_tokens === "number"
          ? json.usage.cache_read_input_tokens
          : undefined;

      const usage: AIUsage = {
        input_tokens,
        output_tokens,
        ...(cached != null ? { cached_tokens: cached } : {}),
        estimated_cost: this.estimateCost({ input_tokens, output_tokens }, model),
        actual_cost: null,
      };

      if (req.max_cost != null && (usage.estimated_cost ?? 0) > req.max_cost) {
        return makeAIError("cost_limit", "anthropic_cost_limit", {
          provider: "anthropic",
          model,
          usage,
          latency_ms: Date.now() - started,
        });
      }

      return {
        ok: true,
        provider: "anthropic",
        model,
        text,
        usage,
        latency_ms: Date.now() - started,
        ...(json.id ? { request_id: json.id } : {}),
        ...(json.stop_reason ? { finish_reason: json.stop_reason } : {}),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.toLowerCase().includes("abort") ? "timeout" : "upstream";
      return makeAIError(code, msg.slice(0, 200), {
        provider: "anthropic",
        model,
        latency_ms: Date.now() - started,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
