/**
 * Gateway audit — mirrors provider call metadata into governance audit.
 */

import { recordAudit } from "@/ai/governance/audit";
import type { AIProviderId, AIUsage } from "@/ai/providers/types";

export type GatewayAuditInput = {
  run_id?: string;
  user_id?: string;
  agent_id?: string;
  provider: AIProviderId;
  model: string;
  prompt_version?: string;
  usage?: AIUsage;
  latency_ms?: number;
  estimated_cost?: number;
  status: "ok" | "error" | "fallback" | "aborted";
  error_code?: string;
  runtime_mode?: string;
  fallback_used?: boolean;
};

export function recordGatewayAudit(input: GatewayAuditInput): void {
  recordAudit({
    kind: "ai_gateway",
    user_id: input.user_id ?? "system",
    subject_id: input.run_id ?? `gw_${Date.now().toString(36)}`,
    ...(input.run_id ? { run_id: input.run_id } : {}),
    ...(input.agent_id ? { agent_id: input.agent_id } : {}),
    status: input.status,
    ...(input.latency_ms != null ? { latency_ms: input.latency_ms } : {}),
    model: input.model,
    ...(input.usage
      ? {
          token_usage: {
            input: input.usage.input_tokens,
            output: input.usage.output_tokens,
          },
        }
      : {}),
    ...(input.estimated_cost != null ? { estimated_cost: input.estimated_cost } : {}),
    created_at: new Date().toISOString(),
    summary: `gateway:${input.status}:${input.provider}`,
    metadata: {
      provider: input.provider,
      ...(input.prompt_version ? { prompt_version: input.prompt_version } : {}),
      ...(input.usage
        ? {
            input_tokens: input.usage.input_tokens,
            output_tokens: input.usage.output_tokens,
            ...(input.usage.cached_tokens != null
              ? { cached_tokens: input.usage.cached_tokens }
              : {}),
          }
        : {}),
      ...(input.error_code ? { error_code: input.error_code } : {}),
      ...(input.runtime_mode ? { runtime_mode: input.runtime_mode } : {}),
      ...(input.fallback_used != null ? { fallback_used: input.fallback_used } : {}),
    },
  });
}
