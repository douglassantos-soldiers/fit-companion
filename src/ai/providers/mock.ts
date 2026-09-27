/**
 * Mock AI provider — deterministic structured JSON for tests.
 */

import { makeAIError } from "@/ai/providers/errors";
import type { AIProvider, AIRequest, AIResult, AIUsage } from "@/ai/providers/types";

function roughTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

const DEFAULT_STRUCTURED = {
  analysis: {
    summary: "Mock training analysis — deterministic_runtime fallback peer",
    training_mode_hint: "express",
  },
  evidence: [
    { signal: "mock_evidence", value: "deterministic", source: "mock_provider" },
  ],
  confidence: 0.72,
  proposal: {
    proposed_type: "EXPRESS_WORKOUT",
    proposed_value: "express",
    reason_codes: ["time_limited"],
    confidence: 0.7,
  },
};

export type MockProviderOpts = {
  /** Override JSON body returned by generate */
  responseBody?: unknown;
  /** Force error on generate */
  failWith?: Parameters<typeof makeAIError>[0];
  failMessage?: string;
  /** Fail with failWith for the first N calls, then succeed */
  failTimes?: number;
};

export class MockAIProvider implements AIProvider {
  readonly id = "mock" as const;
  private opts: MockProviderOpts;
  private callCount = 0;

  constructor(opts: MockProviderOpts = {}) {
    this.opts = opts;
  }

  setOpts(opts: MockProviderOpts): void {
    this.opts = opts;
    this.callCount = 0;
  }

  countTokens(text: string): number {
    return roughTokens(text);
  }

  estimateCost(usage: AIUsage): number {
    return Math.round(((usage.input_tokens + usage.output_tokens) / 1_000_000) * 0.5 * 10000) / 10000;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: "mock_ok" };
  }

  async stream(): Promise<ReturnType<typeof makeAIError>> {
    return makeAIError("not_implemented", "mock_stream_not_implemented", { provider: "mock" });
  }

  async generate(req: AIRequest): Promise<AIResult> {
    const started = Date.now();
    this.callCount += 1;
    const failTimes = this.opts.failTimes ?? (this.opts.failWith ? Infinity : 0);
    if (this.opts.failWith && this.callCount <= failTimes) {
      return makeAIError(this.opts.failWith, this.opts.failMessage ?? this.opts.failWith, {
        provider: "mock",
        model: req.model ?? "mock-v1",
        latency_ms: Date.now() - started,
      });
    }

    const body = this.opts.responseBody ?? DEFAULT_STRUCTURED;
    const text = typeof body === "string" ? body : JSON.stringify(body);
    const input_tokens = req.messages.reduce((s, m) => s + roughTokens(m.content), 0);
    const output_tokens = roughTokens(text);
    const usage: AIUsage = {
      input_tokens,
      output_tokens,
      estimated_cost: this.estimateCost({ input_tokens, output_tokens }),
    };

    if (req.max_cost != null && (usage.estimated_cost ?? 0) > req.max_cost) {
      return makeAIError("cost_limit", "mock_estimated_cost_exceeded", {
        provider: "mock",
        model: "mock-v1",
        usage,
        latency_ms: Date.now() - started,
      });
    }

    return {
      ok: true,
      provider: "mock",
      model: req.model ?? "mock-v1",
      text,
      usage,
      latency_ms: Date.now() - started,
      request_id: `mock_${Date.now().toString(36)}`,
      finish_reason: "stop",
    };
  }
}

let sharedMock: MockAIProvider | null = null;

export function getMockAIProvider(): MockAIProvider {
  if (!sharedMock) sharedMock = new MockAIProvider();
  return sharedMock;
}

export function resetMockAIProvider(): void {
  sharedMock = new MockAIProvider();
}
