/**
 * AI Gateway — invokeAI entrypoint.
 * Agents → Gateway → Provider → validate → DecisionProposal (candidate only).
 * FASE 22.4 — cost budgets, request_id audit, no production mock fallback.
 */

import { getAgentAIConfig } from "@/ai/gateway/config";
import { recordGatewayAudit } from "@/ai/gateway/audit";
import { checkAiCostLimits, recordAiCost } from "@/ai/gateway/cost-limits";
import { generateWithFallback } from "@/ai/gateway/fallback";
import { buildMessagesForAgent } from "@/ai/gateway/prompts";
import { getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";
import {
  validateAndBridgeStructured,
  type LlmStructuredOutput,
  type ValidatedLlmOutput,
} from "@/ai/gateway/validate";
import { makeAIError, isProductionMockProviderError } from "@/ai/providers/errors";
import type { AIError, AIProviderId, AIRequest, AIUsage } from "@/ai/providers/types";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import { isAiEnabled } from "@/ai/runtime/feature-flags";
import { resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";
import { checkAiRateLimits } from "@/ai/runtime/rate-limit";
import { assertProviderAllowedInEnv, resolveLlmEnvironment } from "@/ai/gateway/runtime/env";

export type AiExecutionStatus = "ok" | "error" | "degraded" | "aborted" | "fallback";

export type InvokeAIInput = {
  agentId: string;
  userId?: string;
  runId?: string;
  /** User / context payload for the prompt */
  userContent: string;
  /** Override runtime mode for tests */
  runtimeMode?: AiRuntimeMode;
  /** Force provider (tests) */
  provider?: AIProviderId;
  fallbackProvider?: AIProviderId;
  /** Skip structured validate (raw text only) — default false */
  skipValidate?: boolean;
  /** Extra AIRequest overrides */
  request?: Partial<AIRequest>;
};

export type InvokeAISuccess = {
  ok: true;
  provider: AIProviderId;
  model: string;
  prompt_version: string;
  text: string;
  usage: AIUsage;
  latency_ms: number;
  runtime_mode: AiRuntimeMode;
  execution_mode: AiRuntimeMode;
  status: AiExecutionStatus;
  fallback_used: boolean;
  request_id?: string;
  structured: LlmStructuredOutput | null;
  decision_proposal: DecisionProposal | null;
  raw: AIResultOk;
};

type AIResultOk = {
  ok: true;
  provider: AIProviderId;
  model: string;
  text: string;
  usage: AIUsage;
  latency_ms: number;
  request_id?: string;
  finish_reason?: string;
};

export type InvokeAIFailure = {
  ok: false;
  error: AIError;
  runtime_mode: AiRuntimeMode;
  execution_mode: AiRuntimeMode;
  status: AiExecutionStatus;
  provider?: AIProviderId | "none";
  model?: string;
  prompt_version?: string;
  usage?: AIUsage;
  latency_ms?: number;
  fallback_used?: boolean;
  request_id?: string;
  rate_limit_headers?: Record<string, string>;
};

export type InvokeAIResult = InvokeAISuccess | InvokeAIFailure;

/**
 * Primary gateway API. Respects AI_RUNTIME_MODE:
 * - deterministic → returns not_configured-style skip (caller uses skills path)
 * - llm | hybrid → provider call + validate
 */
export async function invokeAI(input: InvokeAIInput): Promise<InvokeAIResult> {
  const config = getAgentAIConfig(input.agentId);
  const runtime_mode = resolveEffectiveRuntimeMode(input.runtimeMode ?? getAiRuntimeMode());

  if (!isAiEnabled()) {
    const error = makeAIError("not_configured", "ai_disabled", {
      provider: config.provider,
      model: config.model,
    });
    return {
      ok: false,
      error,
      runtime_mode: "deterministic",
      execution_mode: "deterministic",
      status: "aborted",
      provider: "none",
      model: "deterministic_runtime",
    };
  }

  if (runtime_mode === "deterministic") {
    const error = makeAIError(
      "not_configured",
      "runtime_mode_deterministic_skips_provider",
      { provider: config.provider, model: "deterministic_runtime" },
    );
    recordGatewayAudit({
      ...(input.runId ? { run_id: input.runId } : {}),
      ...(input.userId ? { user_id: input.userId } : {}),
      agent_id: input.agentId,
      provider: config.provider,
      model: "deterministic_runtime",
      prompt_version: config.system_prompt_version,
      status: "aborted",
      error_code: error.code,
      runtime_mode,
    });
    return {
      ok: false,
      error,
      runtime_mode,
      execution_mode: runtime_mode,
      status: "aborted",
      provider: "none",
      model: "deterministic_runtime",
    };
  }

  const primary = input.provider ?? config.provider;
  try {
    assertProviderAllowedInEnv(primary, resolveLlmEnvironment());
  } catch (e) {
    if (isProductionMockProviderError(e)) {
      const error = makeAIError("not_configured", e.message, {
        provider: "mock",
        model: config.model,
        retryable: false,
      });
      recordGatewayAudit({
        ...(input.runId ? { run_id: input.runId } : {}),
        ...(input.userId ? { user_id: input.userId } : {}),
        agent_id: input.agentId,
        provider: "mock",
        model: config.model,
        prompt_version: config.system_prompt_version,
        status: "aborted",
        error_code: "PRODUCTION_MOCK_FORBIDDEN",
        runtime_mode,
      });
      return {
        ok: false,
        error,
        runtime_mode,
        execution_mode: runtime_mode,
        status: "aborted",
        provider: "mock",
        model: config.model,
      };
    }
    throw e;
  }

  const rl = await checkAiRateLimits({
    ...(input.userId ? { userId: input.userId, llmUserId: input.userId } : {}),
    agentId: input.agentId,
    provider: primary,
    model: config.model,
    ...(input.runId ? { runId: input.runId } : {}),
  });
  if (!rl.ok) {
    const error = makeAIError("rate_limit", `ai_rl_${rl.scope}_${rl.window}`, {
      provider: config.provider,
      model: config.model,
    });
    recordGatewayAudit({
      ...(input.runId ? { run_id: input.runId } : {}),
      ...(input.userId ? { user_id: input.userId } : {}),
      agent_id: input.agentId,
      provider: config.provider,
      model: config.model,
      prompt_version: config.system_prompt_version,
      status: "aborted",
      error_code: "rate_limited",
      runtime_mode,
    });
    return {
      ok: false,
      error,
      runtime_mode,
      execution_mode: runtime_mode,
      status: "aborted",
      provider: config.provider,
      model: config.model,
      ...(rl.headers ? { rate_limit_headers: rl.headers } : {}),
    };
  }

  const built = buildMessagesForAgent({
    promptId: config.prompt_id,
    userContent: input.userContent,
  });
  if (!built) {
    const error = makeAIError("invalid_request", `unknown_prompt:${config.prompt_id}`);
    return {
      ok: false,
      error,
      runtime_mode,
      execution_mode: runtime_mode,
      status: "error",
    };
  }

  const secondary = input.fallbackProvider ?? config.fallback_provider;

  const req: AIRequest = {
    provider: primary,
    model: config.model,
    messages: built.messages,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    timeout_ms: config.timeout_ms,
    max_cost: config.max_cost,
    json_mode: true,
    ...(input.runId ? { run_id: input.runId } : {}),
    agent_id: input.agentId,
    prompt_version: built.prompt.version,
    ...input.request,
  };

  // Pre-flight cost: rough estimate from input alone
  const maxCost = req.max_cost ?? config.max_cost;
  const roughIn = req.messages.reduce((s, m) => s + Math.ceil(m.content.length / 4), 0);
  const estPre = (roughIn / 1_000_000) * 0.15 + (config.max_tokens / 1_000_000) * 0.6;
  if (estPre > maxCost) {
    const error = makeAIError("cost_limit", "preflight_cost_exceeded", {
      provider: primary,
      model: config.model,
    });
    recordGatewayAudit({
      ...(input.runId ? { run_id: input.runId } : {}),
      ...(input.userId ? { user_id: input.userId } : {}),
      agent_id: input.agentId,
      provider: primary,
      model: config.model,
      prompt_version: built.prompt.version,
      status: "aborted",
      error_code: "cost_limit",
      runtime_mode,
      estimated_cost: estPre,
    });
    return {
      ok: false,
      error,
      runtime_mode,
      execution_mode: runtime_mode,
      status: "aborted",
      provider: primary,
      model: config.model,
      prompt_version: built.prompt.version,
    };
  }

  const budget = await checkAiCostLimits({
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    estimatedAdd: estPre,
  });
  if (!budget.ok) {
    const error = makeAIError("cost_limit", `budget_${budget.scope}:${budget.detail}`, {
      provider: primary,
      model: config.model,
    });
    recordGatewayAudit({
      ...(input.runId ? { run_id: input.runId } : {}),
      ...(input.userId ? { user_id: input.userId } : {}),
      agent_id: input.agentId,
      provider: primary,
      model: config.model,
      prompt_version: built.prompt.version,
      status: "aborted",
      error_code: "cost_limit",
      runtime_mode,
      estimated_cost: estPre,
    });
    return {
      ok: false,
      error,
      runtime_mode,
      execution_mode: runtime_mode,
      status: "aborted",
      provider: primary,
      model: config.model,
      prompt_version: built.prompt.version,
    };
  }

  const { result, trace } = await generateWithFallback(req, primary, secondary);
  const fallback_used = trace.length > 1 && Boolean(trace[trace.length - 1]?.ok);
  const failStatus: AiExecutionStatus = fallback_used ? "fallback" : "error";

  if (!result.ok) {
    recordGatewayAudit({
      ...(input.runId ? { run_id: input.runId } : {}),
      ...(input.userId ? { user_id: input.userId } : {}),
      agent_id: input.agentId,
      provider: result.provider ?? primary,
      model: result.model ?? config.model,
      prompt_version: built.prompt.version,
      ...(result.usage ? { usage: result.usage } : {}),
      ...(result.latency_ms != null ? { latency_ms: result.latency_ms } : {}),
      status: failStatus,
      error_code: result.code,
      runtime_mode,
      fallback_used,
    });
    return {
      ok: false,
      error: result,
      runtime_mode,
      execution_mode: runtime_mode,
      status: failStatus,
      provider: result.provider ?? primary,
      model: result.model ?? config.model,
      prompt_version: built.prompt.version,
      ...(result.usage ? { usage: result.usage } : {}),
      ...(result.latency_ms != null ? { latency_ms: result.latency_ms } : {}),
      fallback_used,
    };
  }

  let structured: LlmStructuredOutput | null = null;
  let decision_proposal: DecisionProposal | null = null;

  if (!input.skipValidate) {
    const validated = validateAndBridgeStructured({
      text: result.text,
      agentId: input.agentId,
      userId: input.userId ?? "",
      skillId: `llm:${input.agentId}`,
    });
    if (!("structured" in validated)) {
      recordGatewayAudit({
        ...(input.runId ? { run_id: input.runId } : {}),
        ...(input.userId ? { user_id: input.userId } : {}),
        agent_id: input.agentId,
        provider: result.provider,
        model: result.model,
        prompt_version: built.prompt.version,
        usage: result.usage,
        latency_ms: result.latency_ms,
        ...(result.request_id ? { request_id: result.request_id } : {}),
        ...(result.usage.estimated_cost != null
          ? { estimated_cost: result.usage.estimated_cost }
          : {}),
        ...(result.usage.actual_cost !== undefined
          ? { actual_cost: result.usage.actual_cost ?? null }
          : {}),
        status: "error",
        error_code: validated.code,
        runtime_mode,
        fallback_used,
      });
      return {
        ok: false,
        error: validated,
        runtime_mode,
        execution_mode: runtime_mode,
        status: "error",
        provider: result.provider,
        model: result.model,
        prompt_version: built.prompt.version,
        usage: result.usage,
        latency_ms: result.latency_ms,
        fallback_used,
        ...(result.request_id ? { request_id: result.request_id } : {}),
      };
    }
    structured = validated.structured;
    decision_proposal = validated.decision_proposal;
  }

  const cost = result.usage.estimated_cost ?? 0;
  if (cost > 0) {
    await recordAiCost({
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      cost,
    });
  }

  const okStatus: AiExecutionStatus = fallback_used ? "fallback" : "ok";
  recordGatewayAudit({
    ...(input.runId ? { run_id: input.runId } : {}),
    ...(input.userId ? { user_id: input.userId } : {}),
    agent_id: input.agentId,
    provider: result.provider,
    model: result.model,
    prompt_version: built.prompt.version,
    usage: result.usage,
    latency_ms: result.latency_ms,
    ...(result.request_id ? { request_id: result.request_id } : {}),
    ...(result.usage.estimated_cost != null
      ? { estimated_cost: result.usage.estimated_cost }
      : {}),
    ...(result.usage.actual_cost !== undefined
      ? { actual_cost: result.usage.actual_cost ?? null }
      : {}),
    status: okStatus,
    runtime_mode,
    fallback_used,
  });

  return {
    ok: true,
    provider: result.provider,
    model: result.model,
    prompt_version: built.prompt.version,
    text: result.text,
    usage: result.usage,
    latency_ms: result.latency_ms,
    runtime_mode,
    execution_mode: runtime_mode,
    status: okStatus,
    fallback_used,
    ...(result.request_id ? { request_id: result.request_id } : {}),
    structured,
    decision_proposal,
    raw: result,
  };
}

export type { ValidatedLlmOutput, LlmStructuredOutput };
