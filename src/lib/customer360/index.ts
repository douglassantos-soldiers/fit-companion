/**
 * Customer 360 — aggregation layer (not a monolithic table).
 * Goals come from profile/onboarding — NEVER inferred solely from purchased products.
 */
import { aggregateCommerceFromState } from "@/lib/customer360/aggregators/commerce";
import { aggregatePerformance } from "@/lib/customer360/aggregators/performance";
import { aggregateNutrition } from "@/lib/customer360/aggregators/nutrition";
import { aggregateRecovery } from "@/lib/customer360/aggregators/recovery";
import { aggregateSupplements } from "@/lib/customer360/aggregators/supplements";
import { aggregateBehavior } from "@/lib/customer360/aggregators/behavior";
import { aggregateGoals } from "@/lib/customer360/aggregators/goals";
import type { AppState } from "@/lib/types";
import type { RecoverySnapshot } from "@/lib/engine/recovery";
import {
  buildDefaultLineage,
  buildEstimatesFromCommerce,
  type Commerce360,
  type Customer360,
  type Behavior360,
  type Goals360,
  type Nutrition360,
  type Performance360,
  type Recovery360,
  type Supplements360,
  type Athlete360,
} from "@/lib/customer360/types";
import { activityFromLogEntry, activityFromSession } from "@/lib/athlete/normalize";
import { buildAthlete360 } from "@/lib/athlete/profile";

export type {
  Commerce360,
  Customer360,
  Behavior360,
  Goals360,
  Nutrition360,
  Performance360,
  Recovery360,
  Supplements360,
  Athlete360,
} from "@/lib/customer360/types";

/** Build Customer 360 from local AppState (client-safe, no secrets). */
export function buildCustomer360FromState(
  state: AppState,
  opts?: {
    userId?: string | null;
    shopifyCustomerId?: string | null;
    date?: string;
    recoverySnapshot?: RecoverySnapshot;
  },
): Customer360 {
  const performance = aggregatePerformance(state);
  const commerce = aggregateCommerceFromState(state);
  const userId = opts?.userId ?? "local";
  const fromLogs = (state.activityLogs ?? []).map((e) => activityFromLogEntry(userId, e));
  const fromSessions = (state.sessions ?? []).map((s) => activityFromSession(userId, s));
  const athlete: Athlete360 = buildAthlete360({
    sessions: state.sessions ?? [],
    activities: [...fromSessions, ...fromLogs],
  });
  return {
    userId: opts?.userId ?? null,
    shopifyCustomerId: opts?.shopifyCustomerId ?? null,
    commerce,
    performance,
    nutrition: aggregateNutrition(state),
    recovery: aggregateRecovery(
      state,
      performance.avgRpeHardStreak,
      opts?.date,
      opts?.recoverySnapshot,
    ),
    supplements: aggregateSupplements(state),
    behavior: aggregateBehavior(state),
    goals: aggregateGoals(state),
    athlete,
    lineage: buildDefaultLineage(),
    estimates: buildEstimatesFromCommerce(commerce),
    updatedAt: new Date().toISOString(),
  };
}

/** Alias matching architecture plan naming. */
export const buildCustomer360 = buildCustomer360FromState;

/** Merge DB commerce metrics into a Customer360 built from state. */
export function mergeCommerceInto360(
  base: Customer360,
  commerce: Partial<Commerce360>,
): Customer360 {
  const merged = { ...base.commerce, ...commerce };
  return {
    ...base,
    commerce: merged,
    estimates: buildEstimatesFromCommerce(merged),
    updatedAt: new Date().toISOString(),
  };
}
