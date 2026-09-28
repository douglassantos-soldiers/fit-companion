/**
 * In-process circuit breaker per provider (FASE 22.4).
 * Open ≠ mock fallback — caller skips provider or fails closed.
 */

import type { AIProviderId } from "@/ai/providers/types";

export type CircuitState = "closed" | "open" | "half_open";

type BreakerEntry = {
  failures: number;
  openedAt: number | null;
  state: CircuitState;
};

const DEFAULT_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 60_000;

const store = new Map<AIProviderId, BreakerEntry>();

function threshold(): number {
  const n = Number(process.env["AI_CB_FAILURE_THRESHOLD"] ?? DEFAULT_THRESHOLD);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD;
}

function cooldownMs(): number {
  const n = Number(process.env["AI_CB_COOLDOWN_MS"] ?? DEFAULT_COOLDOWN_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_COOLDOWN_MS;
}

function entry(id: AIProviderId): BreakerEntry {
  let e = store.get(id);
  if (!e) {
    e = { failures: 0, openedAt: null, state: "closed" };
    store.set(id, e);
  }
  return e;
}

export function getCircuitState(id: AIProviderId): CircuitState {
  const e = entry(id);
  if (e.state === "open" && e.openedAt != null) {
    if (Date.now() - e.openedAt >= cooldownMs()) {
      e.state = "half_open";
      return "half_open";
    }
  }
  return e.state;
}

/** True when provider may be called. */
export function canCallProvider(id: AIProviderId): boolean {
  const s = getCircuitState(id);
  return s === "closed" || s === "half_open";
}

export function recordCircuitSuccess(id: AIProviderId): void {
  const e = entry(id);
  e.failures = 0;
  e.openedAt = null;
  e.state = "closed";
}

export function recordCircuitFailure(id: AIProviderId): void {
  const e = entry(id);
  e.failures += 1;
  if (e.state === "half_open" || e.failures >= threshold()) {
    e.state = "open";
    e.openedAt = Date.now();
  }
}

export function resetCircuitBreakers(): void {
  store.clear();
}

export function getCircuitSnapshot(): Record<string, { state: CircuitState; failures: number }> {
  const out: Record<string, { state: CircuitState; failures: number }> = {};
  for (const id of ["openai", "anthropic", "google", "mock"] as AIProviderId[]) {
    const e = store.get(id);
    out[id] = {
      state: e ? getCircuitState(id) : "closed",
      failures: e?.failures ?? 0,
    };
  }
  return out;
}
