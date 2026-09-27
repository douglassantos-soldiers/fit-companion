/**
 * AI Gateway — invokeAI entrypoint.
 * Agents → Gateway → Provider → validate → DecisionProposal (candidate only).
 */

import { getAgentAIConfig } from "@/ai/gateway/config";
import { recordGatewayAudit } from "@/ai/gateway/audit";
import { generateWithFallback } from "@/ai/gateway/fallback";
import { buildMessagesForAgent } from "@/ai/gateway/prompts";
import { getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";
import {
  validateAndBridgeStructured,
  type LlmStructuredOutput,
  type ValidatedLlmOutput,
} from "@/ai/gateway/validate";
import { makeAIError } from "@/ai/providers/errors";
import type { AIError, AIProviderId, AIRequest, AIResult, AIUsage } from "@/ai/providers/types";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import { isAiEnabled } from "@/ai/runtime/feature-flags";
import { resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";
import { checkAiRateLimits } from "@/ai/runtime/rate-limit";

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
  fallback_used: boolean;
  structured: LlmStructuredOutput | null;
  decision_proposal: DecisionProposal | null;
  raw: AIResult;
};

export type InvokeAIFailure = {
  ok: false;
  error: AIError;
  runtime_mode: AiRuntimeMode;
  provider?: AIProviderId;
  model?: string;
  prompt_version?: string;
  usage?: AIUsage;
  latency_ms?: number;
  fallback_used?: boolean;
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
    return { ok: false, error, runtime_mode: "deterministic", provider: config.provider, model: config.model };
  }

  if (runtime_mode === "deterministic") {
    const error = makeAIError(
      "not_configured",
      "runtime_mode_deterministic_skips_provider",
      { provider: config.provider, model: config.model },
    );
    recordGatewayAudit({
      ...(input.runId ? { run_id: input.runId } : {}),
      ...(input.userId ? { user_id: input.userId } : {}),
      agent_id: input.agentId,
      provider: config.provider,
      model: config.model,
      prompt_version: config.system_prompt_version,
      status: "aborted",
      error_code: error.code,
      runtime_mode,
    });
    return { ok: false, error, runtime_mode, provider: config.provider, model: config.model };
  }

  const rl = checkAiRateLimits({
    ...(input.userId ? { userId: input.userId } : {}),
    agentId: input.agentId,
    provider: input.provider ?? config.provider,
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
    return { ok: false, error, runtime_mode, provider: config.provider, model: config.model };
  }

  const built = buildMessagesForAgent({
    promptId: config.prompt_id,
    userContent: input.userContent,
  });
  if (!built) {
    const error = makeAIError("invalid_request", `unknown_prompt:${config.prompt_id}`);
    return { ok: false, error, runtime_mode };
  }

  const primary = input.provider ?? config.provider;
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
      provider: primary,
      model: config.model,
      prompt_version: built.prompt.version,
    };
  }

  const { result, trace } = await generateWithFallback(req, primary, secondary);
  const fallback_used = trace.length > 1 && Boolean(trace[trace.length - 1]?.ok);

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
      status: fallback_used ? "fallback" : "error",
      error_code: result.code,
      runtime_mode,
      fallback_used,
    });
    return {
      ok: false,
      error: result,
      runtime_mode,
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
        ...(result.usage.estimated_cost != null
          ? { estimated_cost: result.usage.estimated_cost }
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
        provider: result.provider,
        model: result.model,
        prompt_version: built.prompt.version,
        usage: result.usage,
        latency_ms: result.latency_ms,
        fallback_used,
      };
    }
    structured = validated.structured;
    decision_proposal = validated.decision_proposal;
  }

  recordGatewayAudit({
    ...(input.runId ? { run_id: input.runId } : {}),
    ...(input.userId ? { user_id: input.userId } : {}),
    agent_id: input.agentId,
    provider: result.provider,
    model: result.model,
    prompt_version: built.prompt.version,
    usage: result.usage,
    latency_ms: result.latency_ms,
    ...(result.usage.estimated_cost != null
      ? { estimated_cost: result.usage.estimated_cost }
      : {}),
    status: fallback_used ? "fallback" : "ok",
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
    fallback_used,
    structured,
    decision_proposal,
    raw: result,
  };
}

export type { ValidatedLlmOutput, LlmStructuredOutput };
