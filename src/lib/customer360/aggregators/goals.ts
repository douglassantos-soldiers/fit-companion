/**
 * Goals aggregator — explicit profile/onboarding only.
 * NEVER infer goal from purchaseProductIds / Shopify products.
 */
import type { AppState } from "@/lib/types";
import type { Goals360 } from "@/lib/customer360/types";

export function aggregateGoals(state: AppState): Goals360 {
  const profile = state.profile;
  return {
    currentGoal: profile?.goal ?? null,
    level: profile?.level ?? null,
    daysPerWeek: profile?.daysPerWeek ?? null,
    source: profile ? "profile" : "none",
  };
}
