/**
 * FASE 22.4 — LLM health check + readiness.
 */

import { getCircuitSnapshot } from "@/ai/gateway/circuit-breaker";
import { getGatewayRuntimeSnapshot } from "@/ai/gateway/config";
import { getAiRuntimeMode } from "@/ai/gateway/runtime-mode";
import {
  resolveFallbackProvider,
  resolveLlmEnvironment,
  resolvePrimaryProvider,
} from "@/ai/gateway/runtime/env";
import { getProvider } from "@/ai/providers/registry";
import { getAiFeatureFlags } from "@/ai/runtime/feature-flags";

export type LlmHealthCheckId =
  | "environment"
  | "primary_provider"
  | "mock_policy"
  | "provider_ping"
  | "circuit"
  | "kill_switch";

export type LlmHealthCheckResult = {
  id: LlmHealthCheckId;
  ok: boolean;
  detail?: string;
};

export type LlmHealthReport = {
  ok: boolean;
  environment: ReturnType<typeof resolveLlmEnvironment>;
  runtime_mode: ReturnType<typeof getAiRuntimeMode>;
  primary: string;
  fallback: string | null;
  checks: LlmHealthCheckResult[];
  generated_at: string;
};

export type LlmLiveProbeResult = {
  ok: boolean;
  detail?: string;
  latency_ms?: number;
  provider?: string;
  model?: string;
  request_id?: string;
  status?: "ok" | "error" | "skipped";
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost?: number;
  error_category?: string;
};

export type LlmReadinessResult = {
  LLM_READY: boolean;
  reasons: string[];
  health: LlmHealthReport;
};

export async function checkLlmHealth(): Promise<LlmHealthReport> {
  const environment = resolveLlmEnvironment();
  const runtime_mode = getAiRuntimeMode();
  const checks: LlmHealthCheckResult[] = [];
  let primary = "unknown";
  let fallback: string | null = null;

  checks.push({
    id: "environment",
    ok: true,
    detail: environment,
  });

  try {
    primary = resolvePrimaryProvider(environment);
    fallback = resolveFallbackProvider(environment) ?? null;
    checks.push({
      id: "primary_provider",
      ok: primary !== "mock" || environment !== "production",
      detail: primary,
    });
  } catch (e) {
    checks.push({
      id: "primary_provider",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const mockOk =
    environment !== "production" ||
    (primary !== "mock" && fallback !== "mock");
  checks.push({
    id: "mock_policy",
    ok: mockOk,
    detail: mockOk ? "mock_not_in_prod_path" : "mock_in_production",
  });

  try {
    const provider = getProvider(primary as "openai" | "anthropic" | "google" | "mock");
    const ping = await provider.healthCheck();
    checks.push({
      id: "provider_ping",
      ok: ping.ok || environment === "test",
      detail: ping.detail ?? (ping.ok ? "ok" : "ping_failed"),
    });
  } catch (e) {
    checks.push({
      id: "provider_ping",
      ok: environment === "test",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const circuits = getCircuitSnapshot();
  const primaryCircuit = circuits[primary];
  checks.push({
    id: "circuit",
    ok: !primaryCircuit || primaryCircuit.state !== "open",
    detail: primaryCircuit
      ? `${primary}=${primaryCircuit.state}:f${primaryCircuit.failures}`
      : "closed",
  });

  const flags = getAiFeatureFlags();
  checks.push({
    id: "kill_switch",
    ok: true,
    detail: flags.llm_enabled
      ? "llm_enabled"
      : flags.force_deterministic
        ? "force_deterministic"
        : "llm_disabled",
  });

  // Prefer already-resolved primary/fallback — avoid rethrow from snapshot when mock misconfigured
  let reportPrimary = primary;
  let reportFallback = fallback;
  try {
    const snap = getGatewayRuntimeSnapshot();
    reportPrimary = snap.primary;
    reportFallback = snap.fallback ?? null;
  } catch {
    // keep resolvePrimaryProvider results; mock misconfig already recorded in checks
  }

  return {
    ok: checks.every((c) => c.ok),
    environment,
    runtime_mode,
    primary: reportPrimary,
    fallback: reportFallback,
    checks,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Optional live generate probe when AI_LLM_LIVE_PROBE=1 and keys present.
 * Never logs API keys or prompt content.
 */
export async function checkLlmLiveProbe(): Promise<LlmLiveProbeResult> {
  const enabled =
    process.env["AI_LLM_LIVE_PROBE"] === "1" ||
    process.env["AI_LLM_LIVE_PROBE"] === "true";
  if (!enabled) {
    return { ok: false, detail: "live_probe_disabled", status: "skipped" };
  }

  const env = resolveLlmEnvironment();
  let primary: ReturnType<typeof resolvePrimaryProvider>;
  try {
    primary = resolvePrimaryProvider(env);
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      status: "error",
      error_category: "config",
    };
  }
  if (primary === "mock") {
    return {
      ok: false,
      detail: "mock_not_valid_live_probe",
      status: "error",
      error_category: "mock_forbidden",
    };
  }

  const provider = getProvider(primary);
  const model =
    primary === "anthropic"
      ? process.env["AI_ANTHROPIC_MODEL"]?.trim() || "claude-3-5-haiku-latest"
      : process.env["AI_OPENAI_MODEL"]?.trim() || "gpt-4o-mini";
  const started = Date.now();
  const result = await provider.generate({
    provider: primary,
    model,
    messages: [
      { role: "system", content: "Reply with JSON only." },
      {
        role: "user",
        content: JSON.stringify({
          analysis: { ping: true },
          evidence: [{ signal: "live_probe", value: 1 }],
          confidence: 0.5,
          proposal: null,
        }),
      },
    ],
    max_tokens: 64,
    timeout_ms: 15_000,
    temperature: 0,
    json_mode: true,
  });

  if (!result.ok) {
    return {
      ok: false,
      detail: `${result.code}:${result.message}`,
      latency_ms: Date.now() - started,
      provider: primary,
      model,
      status: "error",
      error_category: result.code === "unauthorized" ? "LLM_PROVIDER_UNAVAILABLE" : result.code,
    };
  }
  return {
    ok: true,
    detail: "live_ok",
    latency_ms: result.latency_ms,
    provider: result.provider,
    model: result.model,
    status: "ok",
    ...(result.request_id ? { request_id: result.request_id } : {}),
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
    ...(result.usage.estimated_cost != null
      ? { estimated_cost: result.usage.estimated_cost }
      : {}),
  };
}

export async function getLlmReadiness(): Promise<LlmReadinessResult> {
  const health = await checkLlmHealth();
  const reasons: string[] = [];
  const env = health.environment;

  for (const c of health.checks) {
    if (!c.ok) reasons.push(`${c.id}:${c.detail ?? "fail"}`);
  }

  if (env === "production" && health.primary === "mock") {
    reasons.push("production_forbids_mock");
  }

  // Production: primary must ping OK. Test: softer (mock ok).
  let LLM_READY = health.ok && reasons.length === 0;
  if (env === "production") {
    const ping = health.checks.find((c) => c.id === "provider_ping");
    if (!ping?.ok) {
      LLM_READY = false;
      if (!reasons.some((r) => r.startsWith("provider_ping"))) {
        reasons.push("provider_ping:required_in_production");
      }
    }
  }

  return { LLM_READY, reasons, health };
}
