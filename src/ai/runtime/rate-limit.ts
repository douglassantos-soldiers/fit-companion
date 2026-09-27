/**
 * In-process AI rate limits (FASE 21). Not distributed — document multi-instance limit in runbook.
 */
import { rateLimitWindows } from "@/lib/access-session.server";

export type AiRateLimitScope = "user" | "agent" | "provider" | "model" | "tool" | "run";

export type AiRateLimitResult = { ok: true } | { ok: false; scope: string; window: string };

function numEnv(name: string, fallback: number): number {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Defaults conservative; override via AI_RL_* env. */
export function getAiRateLimitDefaults() {
  return {
    user_rpm: numEnv("AI_RL_USER_RPM", 30),
    agent_rpm: numEnv("AI_RL_AGENT_RPM", 60),
    provider_rpm: numEnv("AI_RL_PROVIDER_RPM", 120),
    model_rpm: numEnv("AI_RL_MODEL_RPM", 120),
    tool_rpm: numEnv("AI_RL_TOOL_RPM", 90),
    run_per_invoke: numEnv("AI_RL_RUN_PER_INVOKE", 1),
  };
}

export function checkAiRateLimits(keys: {
  userId?: string;
  agentId?: string;
  provider?: string;
  model?: string;
  toolId?: string;
  runId?: string;
}): AiRateLimitResult {
  const d = getAiRateLimitDefaults();
  const checks: Array<{ key: string; scope: string; limit: number }> = [];
  if (keys.userId) checks.push({ key: `ai:user:${keys.userId}`, scope: "user", limit: d.user_rpm });
  if (keys.agentId) checks.push({ key: `ai:agent:${keys.agentId}`, scope: "agent", limit: d.agent_rpm });
  if (keys.provider)
    checks.push({ key: `ai:provider:${keys.provider}`, scope: "provider", limit: d.provider_rpm });
  if (keys.model) checks.push({ key: `ai:model:${keys.model}`, scope: "model", limit: d.model_rpm });
  if (keys.toolId) checks.push({ key: `ai:tool:${keys.toolId}`, scope: "tool", limit: d.tool_rpm });
  if (keys.runId)
    checks.push({ key: `ai:run:${keys.runId}`, scope: "run", limit: d.run_per_invoke });

  for (const c of checks) {
    const rl = rateLimitWindows(c.key, [
      { suffix: "rpm", limit: c.limit, windowMs: 60_000 },
    ]);
    if (!rl.ok) return { ok: false, scope: c.scope, window: rl.window };
  }
  return { ok: true };
}
