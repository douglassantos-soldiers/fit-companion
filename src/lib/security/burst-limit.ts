/**
 * Shared burst / sliding-window rate limit for product server functions.
 * Prefer this over inlining resolveAiRateLimitStore + store.consume.
 */
export async function consumeNamedBurst(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ ok: true } | { ok: false; reason: "rate_limited" }> {
  const { isAiRateLimitDisabled } = await import("@/ai/runtime/rate-limit");
  if (isAiRateLimitDisabled()) return { ok: true };
  const { resolveAiRateLimitStore } = await import("@/ai/runtime/rate-limit-store");
  const store = await resolveAiRateLimitStore();
  const burst = await store.consume({
    key: opts.key,
    limit: opts.limit,
    windowMs: opts.windowMs,
  });
  if (!burst.allowed) return { ok: false, reason: "rate_limited" };
  return { ok: true };
}
