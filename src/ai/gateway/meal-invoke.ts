/**
 * FASE 23.3 — Gateway-mediated meal / multimodal OpenAI calls.
 * Text completions go through invokeAI; vision + whisper use this helper
 * so kill switch, rate limit, timeout, and audit still apply.
 * Meal AI produces suggestions only — NEVER a Decision.
 */

import { recordGatewayAudit } from "@/ai/gateway/audit";
import { getAgentAIConfig } from "@/ai/gateway/config";
import { invokeAI } from "@/ai/gateway/gateway";
import { getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";
import { makeAIError } from "@/ai/providers/errors";
import { getAiFeatureFlags, isAiEnabled } from "@/ai/runtime/feature-flags";
import { resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";
import { checkAiRateLimits } from "@/ai/runtime/rate-limit";

export type MealGatewayTextResult =
  | { ok: true; text: string; request_id?: string; latency_ms: number }
  | { ok: false; error: string; code?: string };

export type MealGatewayMediaResult =
  | { ok: true; text: string; request_id?: string; latency_ms: number }
  | { ok: false; error: string; code?: string };

const MEAL_AGENT = "meal_ai";

/** OpenAI API origin — override with AI_OPENAI_BASE_URL for proxies/Azure-compatible gateways. */
export function resolveOpenAiApiBaseUrl(): string {
  const raw = process.env["AI_OPENAI_BASE_URL"]?.trim() || process.env["OPENAI_BASE_URL"]?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "https://api.openai.com/v1";
}

export function mealOpenAiEndpoint(kind: "vision" | "whisper"): string {
  const base = resolveOpenAiApiBaseUrl();
  return kind === "whisper" ? `${base}/audio/transcriptions` : `${base}/chat/completions`;
}

/**
 * Meal suggestions are non-Decision outputs (Gateway only — never Decision Engine).
 * Kill switches: AI_GLOBAL_ENABLED=false, AI_FORCE_DETERMINISTIC, LLM_ENABLED=false → no provider.
 * When LLM is not explicitly disabled and OPENAI_API_KEY is set, meal may call LLM
 * without flipping the Coach product path off deterministic.
 */
function mealRuntimeMode(): AiRuntimeMode {
  const flags = getAiFeatureFlags();
  if (!flags.ai_enabled || flags.force_deterministic) return "deterministic";
  const mode = resolveEffectiveRuntimeMode(getAiRuntimeMode());
  if (mode === "hybrid" || mode === "llm") return mode;
  if (flags.llm_enabled) return "llm";
  // Explicit LLM off → deterministic. Unset + key → allow meal-only LLM.
  const llmExplicit =
    process.env["AI_LLM_ENABLED"] != null && process.env["AI_LLM_ENABLED"]!.trim() !== ""
      ? process.env["AI_LLM_ENABLED"]
      : process.env["LLM_ENABLED"];
  if (llmExplicit != null && llmExplicit.trim() !== "") {
    const v = llmExplicit.trim().toLowerCase();
    if (v === "0" || v === "false" || v === "off" || v === "no") return "deterministic";
  }
  if (process.env["OPENAI_API_KEY"]?.trim()) return "llm";
  return "deterministic";
}

/** Text meal estimate via canonical invokeAI (skipValidate — JSON meal schema, not Decision). */
export async function invokeMealTextViaGateway(opts: {
  system: string;
  userContent: string;
  userId?: string;
  maxTokens?: number;
}): Promise<MealGatewayTextResult> {
  if (!isAiEnabled()) {
    return { ok: false, error: "ai_disabled", code: "not_configured" };
  }

  const runtimeMode = mealRuntimeMode();
  if (runtimeMode === "deterministic") {
    return { ok: false, error: "runtime_mode_deterministic", code: "not_configured" };
  }

  const res = await invokeAI({
    agentId: MEAL_AGENT,
    ...(opts.userId ? { userId: opts.userId } : {}),
    userContent: opts.userContent,
    runtimeMode,
    skipValidate: true,
    request: {
      max_tokens: opts.maxTokens ?? 500,
      json_mode: true,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.userContent },
      ],
    },
  });

  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      code: res.error.code,
    };
  }
  return {
    ok: true,
    text: res.text,
    ...(res.request_id ? { request_id: res.request_id } : {}),
    latency_ms: res.latency_ms,
  };
}

/** Vision / whisper — gateway controls then OpenAI HTTP (no Decision Engine). */
export async function invokeMealOpenAiHttp(opts: {
  kind: "vision" | "whisper";
  userId?: string;
  body: BodyInit;
  headers?: Record<string, string>;
  /** @deprecated Prefer omitting — URL is resolved from AI_OPENAI_BASE_URL + kind. */
  url?: string;
  timeoutMs?: number;
}): Promise<MealGatewayMediaResult> {
  const started = Date.now();
  if (!isAiEnabled()) {
    return { ok: false, error: "ai_disabled", code: "not_configured" };
  }
  const runtimeMode = mealRuntimeMode();
  if (runtimeMode === "deterministic") {
    return { ok: false, error: "runtime_mode_deterministic", code: "not_configured" };
  }

  const config = getAgentAIConfig(MEAL_AGENT);
  const rl = await checkAiRateLimits({
    ...(opts.userId ? { userId: opts.userId, llmUserId: opts.userId } : {}),
    agentId: MEAL_AGENT,
    provider: "openai",
    model: config.model,
  });
  if (!rl.ok) {
    recordGatewayAudit({
      ...(opts.userId ? { user_id: opts.userId } : {}),
      agent_id: MEAL_AGENT,
      provider: "openai",
      model: config.model,
      prompt_version: config.system_prompt_version,
      status: "aborted",
      error_code: "rate_limited",
      runtime_mode: runtimeMode,
    });
    return { ok: false, error: "rate_limited", code: "rate_limit" };
  }

  const key = process.env["OPENAI_API_KEY"]?.trim();
  if (!key) {
    return { ok: false, error: "OPENAI_API_KEY_missing", code: "not_configured" };
  }

  const timeoutMs = opts.timeoutMs ?? config.timeout_ms;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = opts.url?.trim() || mealOpenAiEndpoint(opts.kind);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        ...opts.headers,
      },
      body: opts.body,
      signal: controller.signal,
    });
    const latency_ms = Date.now() - started;
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      recordGatewayAudit({
        ...(opts.userId ? { user_id: opts.userId } : {}),
        agent_id: MEAL_AGENT,
        provider: "openai",
        model: opts.kind === "whisper" ? "whisper-1" : config.model,
        prompt_version: config.system_prompt_version,
        status: "error",
        error_code: `openai_http_${res.status}`,
        runtime_mode: runtimeMode,
        latency_ms,
      });
      return { ok: false, error: `upstream:${res.status}:${detail}`, code: "upstream" };
    }

    if (opts.kind === "whisper") {
      const json = (await res.json()) as { text?: string };
      const text = json.text?.trim() || "";
      recordGatewayAudit({
        ...(opts.userId ? { user_id: opts.userId } : {}),
        agent_id: MEAL_AGENT,
        provider: "openai",
        model: "whisper-1",
        prompt_version: config.system_prompt_version,
        status: "ok",
        runtime_mode: runtimeMode,
        latency_ms,
      });
      return { ok: true, text, latency_ms };
    }

    const json = (await res.json()) as {
      id?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    recordGatewayAudit({
      ...(opts.userId ? { user_id: opts.userId } : {}),
      agent_id: MEAL_AGENT,
      provider: "openai",
      model: config.model,
      prompt_version: config.system_prompt_version,
      status: "ok",
      runtime_mode: runtimeMode,
      latency_ms,
      ...(json.id ? { request_id: json.id } : {}),
    });
    return {
      ok: true,
      text,
      latency_ms,
      ...(json.id ? { request_id: json.id } : {}),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = msg.toLowerCase().includes("abort") ? "timeout" : "upstream";
    makeAIError(code as "timeout" | "upstream", msg.slice(0, 200), { provider: "openai" });
    recordGatewayAudit({
      ...(opts.userId ? { user_id: opts.userId } : {}),
      agent_id: MEAL_AGENT,
      provider: "openai",
      model: config.model,
      prompt_version: config.system_prompt_version,
      status: "error",
      error_code: code,
      runtime_mode: runtimeMode,
      latency_ms: Date.now() - started,
    });
    return { ok: false, error: msg.slice(0, 200), code };
  } finally {
    clearTimeout(timer);
  }
}
