/**
 * FASE 22.10 — Distributed rate-limit store (Supabase RPC or shared memory).
 */
import { adminDbLoose } from "@/lib/db-admin";

export type RateLimitConsumeResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset_at_ms: number;
  retry_after_sec: number;
  count: number;
  detail?: string;
};

export type RateLimitStore = {
  consume(opts: {
    key: string;
    limit: number;
    windowMs: number;
    amount?: number;
    peek?: boolean;
  }): Promise<RateLimitConsumeResult>;
};

type MemBucket = { count: number; reset: number };

function deniedStore(limit: number, detail: string): RateLimitConsumeResult {
  const now = Date.now();
  return {
    allowed: false,
    remaining: 0,
    limit,
    reset_at_ms: now + 60_000,
    retry_after_sec: 60,
    count: 0,
    detail,
  };
}

/** Shared Map — inject same instance into multiple "instances" for multi-node tests. */
export class SharedMemoryRateLimitStore implements RateLimitStore {
  readonly buckets: Map<string, MemBucket>;
  private nowFn: () => number;

  constructor(buckets?: Map<string, MemBucket>, nowFn?: () => number) {
    this.buckets = buckets ?? new Map();
    this.nowFn = nowFn ?? (() => Date.now());
  }

  async consume(opts: {
    key: string;
    limit: number;
    windowMs: number;
    amount?: number;
    peek?: boolean;
  }): Promise<RateLimitConsumeResult> {
    const amount = Math.max(opts.amount ?? 1, 0);
    const limit = Math.max(opts.limit, 1);
    const now = this.nowFn();
    let cur = this.buckets.get(opts.key);
    if (!cur || now > cur.reset) {
      cur = { count: 0, reset: now + Math.max(opts.windowMs, 1) };
      if (!opts.peek) this.buckets.set(opts.key, cur);
    }
    const next = cur.count + amount;
    const allowed = next <= limit;
    if (!opts.peek && allowed) {
      cur.count = next;
      this.buckets.set(opts.key, cur);
    }
    const count = opts.peek ? cur.count : allowed ? next : cur.count;
    const remaining = Math.max(limit - count, 0);
    const retry = Math.max(Math.ceil((cur.reset - now) / 1000), 1);
    return {
      allowed,
      remaining,
      limit,
      reset_at_ms: cur.reset,
      retry_after_sec: retry,
      count,
    };
  }

  clear(): void {
    this.buckets.clear();
  }
}

export class SupabaseRateLimitStore implements RateLimitStore {
  async consume(opts: {
    key: string;
    limit: number;
    windowMs: number;
    amount?: number;
    peek?: boolean;
  }): Promise<RateLimitConsumeResult> {
    const db = await adminDbLoose();
    if (!db || typeof (db as { rpc?: unknown }).rpc !== "function") {
      return deniedStore(opts.limit, "admin_db_unavailable");
    }
    const rpc = (
      db as unknown as {
        rpc: (
          fn: string,
          args?: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
      }
    ).rpc;
    const { data, error } = await rpc("ai_rate_limit_consume", {
      p_key: opts.key,
      p_limit: opts.limit,
      p_window_ms: opts.windowMs,
      p_amount: opts.amount ?? 1,
      p_peek: opts.peek ?? false,
    });
    if (error) {
      const msg = String(error.message ?? error.code ?? "rpc_error");
      return deniedStore(opts.limit, msg);
    }
    if (!data || typeof data !== "object") {
      return deniedStore(opts.limit, "invalid_rpc_payload");
    }
    const row = data as Record<string, unknown>;
    return {
      allowed: Boolean(row["allowed"]),
      remaining: Number(row["remaining"] ?? 0),
      limit: Number(row["limit"] ?? opts.limit),
      reset_at_ms: Number(row["reset_at_ms"] ?? Date.now() + 60_000),
      retry_after_sec: Number(row["retry_after_sec"] ?? 60),
      count: Number(row["count"] ?? 0),
    };
  }
}

/** Fail-closed when production requires distributed store but none is available. */
export class FailClosedRateLimitStore implements RateLimitStore {
  constructor(private readonly detail = "store_unavailable") {}
  async consume(opts: {
    key: string;
    limit: number;
    windowMs: number;
    amount?: number;
    peek?: boolean;
  }): Promise<RateLimitConsumeResult> {
    return deniedStore(opts.limit, this.detail);
  }
}

let injected: RateLimitStore | null = null;
let sharedDefault: SharedMemoryRateLimitStore | null = null;

export function setAiRateLimitStoreForTests(store: RateLimitStore | null): void {
  injected = store;
}

export function getSharedMemoryRateLimitStore(): SharedMemoryRateLimitStore {
  if (!sharedDefault) sharedDefault = new SharedMemoryRateLimitStore();
  return sharedDefault;
}

export function resetAiRateLimitStoreForTests(): void {
  injected = null;
  sharedDefault?.clear();
  sharedDefault = null;
}

function isProductionLike(): boolean {
  return (
    process.env["NODE_ENV"] === "production" ||
    process.env["AI_LLM_ENV"] === "production" ||
    process.env["AI_RL_BACKEND"] === "supabase"
  );
}

export async function resolveAiRateLimitStore(): Promise<RateLimitStore> {
  if (injected) return injected;
  const backend = (process.env["AI_RL_BACKEND"] ?? "").trim().toLowerCase();
  if (backend === "memory") return getSharedMemoryRateLimitStore();
  if (backend === "failclosed") return new FailClosedRateLimitStore();

  // Vitest / NODE_ENV=test: shared memory unless AI_RL_BACKEND=supabase explicitly
  if (
    backend !== "supabase" &&
    (process.env["VITEST"] === "true" || process.env["NODE_ENV"] === "test")
  ) {
    return getSharedMemoryRateLimitStore();
  }

  if (backend === "supabase" || isProductionLike()) {
    const db = await adminDbLoose();
    if (!db) {
      if (isProductionLike() && process.env["AI_RL_DISABLED"] !== "1") {
        return new FailClosedRateLimitStore("admin_db_unavailable");
      }
      return getSharedMemoryRateLimitStore();
    }
    return new SupabaseRateLimitStore();
  }
  // Prefer supabase when service role present (non-test)
  if (process.env["SUPABASE_SERVICE_ROLE_KEY"] && process.env["SUPABASE_URL"]) {
    return new SupabaseRateLimitStore();
  }
  return getSharedMemoryRateLimitStore();
}
