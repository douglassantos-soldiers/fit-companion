import type { DecisionBundle } from "@/lib/engine/decision";
import type { MealPlanEngineOpts } from "@/lib/nutrition/meal-planner";
import type { AppState } from "@/lib/types";
import { todayKey } from "@/lib/types";

export function mealPlanOptsFromState(
  state: AppState,
  date = todayKey(),
  bundle?: DecisionBundle | null,
): MealPlanEngineOpts {
  const check = state.dayCheckIns?.[date];
  const opts: MealPlanEngineOpts = {};
  if (bundle?.calorieDelta) opts.calorieDelta = bundle.calorieDelta;
  if (bundle?.proteinBias) opts.proteinBias = bundle.proteinBias;
  if (bundle?.mealDistribution) opts.mealDistribution = bundle.mealDistribution;
  if (bundle?.trainingMode) opts.trainingMode = bundle.trainingMode;
  if (check?.lunchOutToday) opts.lunchOutToday = true;
  if (check?.skippedSlots?.length) opts.skippedSlots = check.skippedSlots;
  if (state.favoriteMealPresetIds?.length) opts.favoritePresetIds = state.favoriteMealPresetIds;
  return opts;
}
