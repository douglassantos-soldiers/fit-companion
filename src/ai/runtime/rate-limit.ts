/**
 * FASE 22.10 — Distributed AI rate limits (Supabase or shared memory).
 * Kill switch: AI_RL_DISABLED=1 bypasses enforcement.
 */
import {
  getSharedMemoryRateLimitStore,
  resolveAiRateLimitStore,
  type RateLimitConsumeResult,
  type RateLimitStore,
} from "@/ai/runtime/rate-limit-store";

export type AiRateLimitScope =
  | "user"
  | "ip"
  | "session"
  | "agent"
  | "provider"
  | "model"
  | "tool"
  | "llm"
  | "rag"
  | "api"
  | "admin"
  | "run"
  | "store";

export type AiRateLimitHeaders = {
  "Retry-After": string;
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
};

export type AiRateLimitResult =
  | { ok: true; headers?: AiRateLimitHeaders }
  | {
      ok: false;
      scope: string;
      window: string;
      headers: AiRateLimitHeaders;
      detail?: string;
    };

function numEnv(name: string, fallback: number): number {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function isAiRateLimitDisabled(): boolean {
  const raw = process.env["AI_RL_DISABLED"];
  if (raw == null || raw.trim() === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** Defaults conservative; override via AI_RL_* env. */
export function getAiRateLimitDefaults() {
  return {
    user_rpm: numEnv("AI_RL_USER_RPM", 30),
    ip_rpm: numEnv("AI_RL_IP_RPM", 60),
    session_rpm: numEnv("AI_RL_SESSION_RPM", 40),
    agent_rpm: numEnv("AI_RL_AGENT_RPM", 60),
    provider_rpm: numEnv("AI_RL_PROVIDER_RPM", 120),
    model_rpm: numEnv("AI_RL_MODEL_RPM", 120),
    tool_rpm: numEnv("AI_RL_TOOL_RPM", 90),
    llm_rpm: numEnv("AI_RL_LLM_RPM", 20),
    llm_cost_per_min: numEnv("AI_RL_LLM_COST_PER_MIN", 50),
    rag_rpm: numEnv("AI_RL_RAG_RPM", 40),
    api_rpm: numEnv("AI_RL_API_RPM", 60),
    admin_rpm: numEnv("AI_RL_ADMIN_RPM", 20),
    run_per_invoke: numEnv("AI_RL_RUN_PER_INVOKE", 1),
  };
}

function headersFrom(r: RateLimitConsumeResult): AiRateLimitHeaders {
  return {
    "Retry-After": String(r.retry_after_sec),
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.reset_at_ms / 1000)),
  };
}

export type AiRateLimitKeys = {
  userId?: string;
  ip?: string;
  sessionId?: string;
  agentId?: string;
  provider?: string;
  model?: string;
  toolId?: string;
  runId?: string;
  /** LLM request bucket (per user) */
  llmUserId?: string;
  /** RAG retrieval bucket */
  ragUserId?: string;
  /** Generic API surface */
  apiKey?: string;
  /** Admin identity */
  adminId?: string;
  /** Extra cost units for llm cost window (optional) */
  llmCostUnits?: number;
};

/** Per-request limit overrides — never mutate process.env to pass these. */
export type AiRateLimitOverrides = Partial<ReturnType<typeof getAiRateLimitDefaults>>;

type CheckSpec = { key: string; scope: string; window: string; limit: number; amount?: number };

function buildChecks(keys: AiRateLimitKeys, overrides?: AiRateLimitOverrides): CheckSpec[] {
  const d = { ...getAiRateLimitDefaults(), ...overrides };
  const checks: CheckSpec[] = [];
  if (keys.userId)
    checks.push({ key: `ai:user:${keys.userId}`, scope: "user", window: "rpm", limit: d.user_rpm });
  if (keys.ip)
    checks.push({ key: `ai:ip:${keys.ip}`, scope: "ip", window: "rpm", limit: d.ip_rpm });
  if (keys.sessionId)
    checks.push({
      key: `ai:session:${keys.sessionId}`,
      scope: "session",
      window: "rpm",
      limit: d.session_rpm,
    });
  if (keys.agentId)
    checks.push({
      key: `ai:agent:${keys.agentId}`,
      scope: "agent",
      window: "rpm",
      limit: d.agent_rpm,
    });
  if (keys.provider)
    checks.push({
      key: `ai:provider:${keys.provider}`,
      scope: "provider",
      window: "rpm",
      limit: d.provider_rpm,
    });
  if (keys.model)
    checks.push({
      key: `ai:model:${keys.model}`,
      scope: "model",
      window: "rpm",
      limit: d.model_rpm,
    });
  if (keys.toolId) {
    checks.push({
      key: `ai:tool:${keys.toolId}`,
      scope: "tool",
      window: "rpm",
      limit: d.tool_rpm,
    });
    if (keys.userId) {
      checks.push({
        key: `ai:user:${keys.userId}:tools`,
        scope: "tool",
        window: "rpm",
        limit: d.tool_rpm,
      });
    }
  }
  if (keys.llmUserId) {
    checks.push({
      key: `ai:llm:req:${keys.llmUserId}`,
      scope: "llm",
      window: "rpm",
      limit: d.llm_rpm,
    });
    const units = Math.max(keys.llmCostUnits ?? 1, 1);
    checks.push({
      key: `ai:llm:cost:${keys.llmUserId}`,
      scope: "llm",
      window: "cost_min",
      limit: d.llm_cost_per_min,
      amount: units,
    });
  }
  if (keys.ragUserId)
    checks.push({
      key: `ai:rag:${keys.ragUserId}`,
      scope: "rag",
      window: "rpm",
      limit: d.rag_rpm,
    });
  if (keys.apiKey)
    checks.push({ key: `ai:api:${keys.apiKey}`, scope: "api", window: "rpm", limit: d.api_rpm });
  if (keys.adminId)
    checks.push({
      key: `ai:admin:${keys.adminId}`,
      scope: "admin",
      window: "rpm",
      limit: d.admin_rpm,
    });
  if (keys.runId)
    checks.push({
      key: `ai:run:${keys.runId}`,
      scope: "run",
      window: "invoke",
      limit: d.run_per_invoke,
    });
  return checks;
}

export async function checkAiRateLimits(
  keys: AiRateLimitKeys,
  store?: RateLimitStore,
  overrides?: AiRateLimitOverrides,
): Promise<AiRateLimitResult> {
  if (isAiRateLimitDisabled()) return { ok: true };

  const backend = store ?? (await resolveAiRateLimitStore());
  const checks = buildChecks(keys, overrides);
  let lastOk: RateLimitConsumeResult | null = null;

  for (const c of checks) {
    const windowMs = c.window === "invoke" ? 60_000 : 60_000;
    const r = await backend.consume({
      key: c.key,
      limit: c.limit,
      windowMs,
      amount: c.amount ?? 1,
    });
    if (!r.allowed) {
      return {
        ok: false,
        scope: c.scope,
        window: c.window,
        headers: headersFrom(r),
        ...(r.detail ? { detail: r.detail } : {}),
      };
    }
    lastOk = r;
  }

  return {
    ok: true,
    ...(lastOk ? { headers: headersFrom(lastOk) } : {}),
  };
}

/**
 * Sync helper for unit tests — SharedMemory only (not multi-instance safe).
 * Prefer `checkAiRateLimits` (async) on production paths.
 */
export function checkAiRateLimitsSync(keys: AiRateLimitKeys): AiRateLimitResult {
  if (isAiRateLimitDisabled()) return { ok: true };
  const mem = getSharedMemoryRateLimitStore();
  const checks = buildChecks(keys);
  const now = Date.now();
  for (const c of checks) {
    const amount = c.amount ?? 1;
    let cur = mem.buckets.get(c.key);
    if (!cur || now > cur.reset) {
      cur = { count: 0, reset: now + 60_000 };
      mem.buckets.set(c.key, cur);
    }
    const next = cur.count + amount;
    if (next > c.limit) {
      const remaining = Math.max(c.limit - cur.count, 0);
      const retry = Math.max(Math.ceil((cur.reset - now) / 1000), 1);
      return {
        ok: false,
        scope: c.scope,
        window: c.window,
        headers: {
          "Retry-After": String(retry),
          "X-RateLimit-Limit": String(c.limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(Math.ceil(cur.reset / 1000)),
        },
      };
    }
    cur.count = next;
  }
  return { ok: true };
}
