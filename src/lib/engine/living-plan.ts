import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import type { DecisionBundle } from "@/lib/engine/decision";
import type { AppState, LivingPlanSnapshot } from "@/lib/types";
import { todayKey } from "@/lib/types";

export type { LivingPlanBuildResult } from "@/lib/engine/living-plan-materialize";

/** Build integrated living plan for a given date (defaults to today). */
export function buildLivingPlan(state: AppState, date = todayKey()): LivingPlanSnapshot | null {
  return buildLivingPlanWithDecisions(state, date)?.plan ?? null;
}

/** Living Plan + Decision Engine bundle — compatibility wrapper over assembleDecisionContext. */
export function buildLivingPlanWithDecisions(
  state: AppState,
  date = todayKey(),
): import("@/lib/engine/living-plan-materialize").LivingPlanBuildResult | null {
  const assembled = assembleDecisionContext(state, { date, source: "offline_legacy" });
  if (!assembled) return null;
  const result: {
    plan: LivingPlanSnapshot;
    decisions: DecisionBundle;
    behavior?: NonNullable<typeof assembled.behavior>;
  } = {
    plan: assembled.livingPlan,
    decisions: assembled.decisions,
  };
  if (assembled.behavior) result.behavior = assembled.behavior;
  return result;
}

export function livingPlanForDate(state: AppState, date = todayKey()): LivingPlanSnapshot | null {
  const fromSnapshot = state.decisionContextByDate?.[date]?.livingPlan;
  if (fromSnapshot) return fromSnapshot;
  return state.livingPlans?.[date] ?? buildLivingPlan(state, date);
}
