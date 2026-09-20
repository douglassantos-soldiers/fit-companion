/**
 * Server-side decision context — single assembly point for intelligence engines.
 * DOMAIN → Customer360 → Context → Safety inputs (deterministic & traceable).
 */
import type { Customer360 } from "@/lib/customer360/types";
import { buildContextSnapshot, type ContextSnapshot } from "@/lib/engine/context-snapshot";
import { evaluateSafetyForDate, type SafetyVerdict } from "@/lib/engine/safety";
import { computeDecisions, type DecisionBundle } from "@/lib/engine/decision";
import type { AppState } from "@/lib/types";
import { DEFAULT_USER_TIMEZONE, getUserTodayKey, normalizeUserTimezone } from "@/lib/timezone";

export type ServerDecisionContext = {
  userId: string;
  date: string;
  timezone: string;
  state: AppState;
  customer360: Customer360 | null;
  snapshot: ContextSnapshot | null;
  safety: SafetyVerdict;
  decisions: DecisionBundle | null;
  stale360: boolean;
};

/**
 * Build authoritative decision context for a user/date from DB-hydrated state + C360.
 */
export async function buildServerDecisionContext(
  userId: string,
  date?: string,
): Promise<ServerDecisionContext | null> {
  if (!userId) return null;

  const { hydrateAppStateFromDb } = await import("@/lib/customer360/hydrate.server");
  const { loadCustomerProfile, isCustomer360Stale, recomputeCustomer360 } = await import(
    "@/lib/customer360/recompute.server"
  );

  let state = await hydrateAppStateFromDb(userId);
  state = { ...state, userId };

  const timezone = normalizeUserTimezone(state.profile?.timezone ?? DEFAULT_USER_TIMEZONE);
  const targetDate = date ?? getUserTodayKey(timezone);

  let customer360 = await loadCustomerProfile(userId);
  const stale360 = isCustomer360Stale(customer360);
  if (stale360) {
    customer360 = await recomputeCustomer360(userId);
  }

  if (customer360?.commerce?.productIds?.length && !state.purchaseProductIds?.length) {
    state = { ...state, purchaseProductIds: customer360.commerce.productIds };
  }

  const snapshot = state.profile ? buildContextSnapshot(state, targetDate) : null;
  const safety = evaluateSafetyForDate(state, targetDate);
  const decisions = snapshot ? computeDecisions(snapshot, safety) : null;

  return {
    userId,
    date: targetDate,
    timezone,
    state,
    customer360,
    snapshot,
    safety,
    decisions,
    stale360,
  };
}
