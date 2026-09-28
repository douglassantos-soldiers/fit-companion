/**
 * Gateway audit — mirrors provider call metadata into governance audit.
 * FASE 22.4 — request_id, tokens, costs; never persist secrets.
 */

import { recordAudit } from "@/ai/governance/audit";
import type { AIProviderId, AIUsage } from "@/ai/providers/types";

const SECRET_KEY_RE =
  /api[_-]?key|authorization|bearer|secret|passwd|password|credential|x-api-key|(^|_)token$|access[_-]?token|id_token|session_token/i;

export type GatewayAuditInput = {
  run_id?: string;
  user_id?: string;
  agent_id?: string;
  request_id?: string;
  provider: AIProviderId;
  model: string;
  prompt_version?: string;
  usage?: AIUsage;
  latency_ms?: number;
  estimated_cost?: number;
  actual_cost?: number | null;
  status: "ok" | "error" | "fallback" | "aborted";
  error_code?: string;
  runtime_mode?: string;
  fallback_used?: boolean;
};

/** Strip secret-like keys from metadata objects (defensive). */
export function redactGatewayMetadata(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_KEY_RE.test(k)) continue;
    if (typeof v === "string" && /sk-[a-zA-Z0-9]{10,}|Bearer\s+\S+/i.test(v)) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function recordGatewayAudit(input: GatewayAuditInput): void {
  const estimated =
    input.estimated_cost ??
    input.usage?.estimated_cost ??
    undefined;
  const actual =
    input.actual_cost !== undefined
      ? input.actual_cost
      : input.usage?.actual_cost !== undefined
        ? input.usage.actual_cost
        : undefined;

  const metadata = redactGatewayMetadata({
    provider: input.provider,
    model: input.model,
    status: input.status,
    ...(input.request_id ? { request_id: input.request_id } : {}),
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
    ...(estimated != null ? { estimated_cost: estimated } : {}),
    ...(actual !== undefined ? { actual_cost: actual } : {}),
    ...(input.latency_ms != null ? { latency_ms: input.latency_ms } : {}),
    ...(input.error_code ? { error_code: input.error_code } : {}),
    ...(input.runtime_mode ? { runtime_mode: input.runtime_mode } : {}),
    ...(input.fallback_used != null ? { fallback_used: input.fallback_used } : {}),
  });

  recordAudit({
    kind: "ai_gateway",
    user_id: input.user_id ?? "system",
    subject_id: input.run_id ?? input.request_id ?? `gw_${Date.now().toString(36)}`,
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
    ...(estimated != null ? { estimated_cost: estimated } : {}),
    created_at: new Date().toISOString(),
    summary: `gateway:${input.status}:${input.provider}`,
    metadata,
  });
}
