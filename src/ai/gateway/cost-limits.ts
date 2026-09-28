/**
 * FASE 22.10 — Distributed AI cost budgets via RateLimitStore.
 * Units: micro-USD (1 USD = 1_000_000). Day window = 24h; run window = 24h keyed by runId.
 */
import { isAiRateLimitDisabled } from "@/ai/runtime/rate-limit";
import {
  getSharedMemoryRateLimitStore,
  resolveAiRateLimitStore,
  resetAiRateLimitStoreForTests,
  type RateLimitStore,
} from "@/ai/runtime/rate-limit-store";

export type AiCostLimitResult =
  | { ok: true }
  | { ok: false; scope: "request" | "user" | "run" | "day"; detail: string };

function numEnv(name: string, fallback: number): number {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Convert USD → integer micro-USD (ceil). */
export function usdToMicros(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.max(1, Math.ceil(usd * 1_000_000));
}

export function getAiCostLimitDefaults() {
  return {
    user_day: numEnv("AI_COST_USER_DAY", 2),
    run_max: numEnv("AI_COST_RUN_MAX", 0.5),
    day_max: numEnv("AI_COST_DAY_MAX", 50),
  };
}

const DAY_MS = 24 * 60 * 60_000;

export async function checkAiCostLimits(
  opts: {
    userId?: string;
    runId?: string;
    estimatedAdd?: number;
  },
  store?: RateLimitStore,
): Promise<AiCostLimitResult> {
  if (isAiRateLimitDisabled()) return { ok: true };
  const d = getAiCostLimitDefaults();
  const add = usdToMicros(opts.estimatedAdd ?? 0);
  const amount = add > 0 ? add : 1;
  const backend = store ?? (await resolveAiRateLimitStore());
  const day = todayKey();

  const dayPeek = await backend.consume({
    key: `ai:cost:day:${day}`,
    limit: usdToMicros(d.day_max),
    windowMs: DAY_MS,
    amount,
    peek: true,
  });
  if (!dayPeek.allowed) {
    return { ok: false, scope: "day", detail: `day_budget_${d.day_max}` };
  }

  if (opts.userId) {
    const u = await backend.consume({
      key: `ai:cost:user:${opts.userId}:${day}`,
      limit: usdToMicros(d.user_day),
      windowMs: DAY_MS,
      amount,
      peek: true,
    });
    if (!u.allowed) {
      return { ok: false, scope: "user", detail: `user_day_budget_${d.user_day}` };
    }
  }

  if (opts.runId) {
    const r = await backend.consume({
      key: `ai:cost:run:${opts.runId}`,
      limit: usdToMicros(d.run_max),
      windowMs: DAY_MS,
      amount,
      peek: true,
    });
    if (!r.allowed) {
      return { ok: false, scope: "run", detail: `run_budget_${d.run_max}` };
    }
  }

  return { ok: true };
}

export async function recordAiCost(opts: {
  userId?: string;
  runId?: string;
  cost: number;
  store?: RateLimitStore;
}): Promise<void> {
  if (isAiRateLimitDisabled()) return;
  const micros = usdToMicros(opts.cost);
  if (micros <= 0) return;
  const d = getAiCostLimitDefaults();
  const backend = opts.store ?? (await resolveAiRateLimitStore());
  const day = todayKey();

  await backend.consume({
    key: `ai:cost:day:${day}`,
    limit: usdToMicros(d.day_max),
    windowMs: DAY_MS,
    amount: micros,
  });
  if (opts.userId) {
    await backend.consume({
      key: `ai:cost:user:${opts.userId}:${day}`,
      limit: usdToMicros(d.user_day),
      windowMs: DAY_MS,
      amount: micros,
    });
  }
  if (opts.runId) {
    await backend.consume({
      key: `ai:cost:run:${opts.runId}`,
      limit: usdToMicros(d.run_max),
      windowMs: DAY_MS,
      amount: micros,
    });
  }
}

/** Clears shared memory cost/rate buckets used in tests. */
export function resetAiCostLimits(): void {
  resetAiRateLimitStoreForTests();
  getSharedMemoryRateLimitStore().clear();
}
