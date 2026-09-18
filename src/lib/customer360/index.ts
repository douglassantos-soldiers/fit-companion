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
import type {
  Commerce360,
  Customer360,
  Behavior360,
  Goals360,
  Nutrition360,
  Performance360,
  Recovery360,
  Supplements360,
} from "@/lib/customer360/types";

export type {
  Commerce360,
  Customer360,
  Behavior360,
  Goals360,
  Nutrition360,
  Performance360,
  Recovery360,
  Supplements360,
} from "@/lib/customer360/types";

/** Build Customer 360 from local AppState (client-safe, no secrets). */
export function buildCustomer360FromState(
  state: AppState,
  opts?: { userId?: string | null },
): Customer360 {
  const performance = aggregatePerformance(state);
  return {
    userId: opts?.userId ?? null,
    commerce: aggregateCommerceFromState(state),
    performance,
    nutrition: aggregateNutrition(state),
    recovery: aggregateRecovery(state, performance.avgRpeHardStreak),
    supplements: aggregateSupplements(state),
    behavior: aggregateBehavior(state),
    goals: aggregateGoals(state),
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
  return {
    ...base,
    commerce: { ...base.commerce, ...commerce },
    updatedAt: new Date().toISOString(),
  };
}
