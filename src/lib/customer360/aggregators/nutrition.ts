import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { todayKey, type AppState } from "@/lib/types";
import type { Nutrition360 } from "@/lib/customer360/types";

function dateNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

export function aggregateNutrition(state: AppState): Nutrition360 {
  const profile = state.profile;
  const meals7 = (state.meals ?? []).filter((m) => {
    const lim = new Date();
    lim.setDate(lim.getDate() - 7);
    return new Date(m.date) >= lim;
  });

  const weights = [...(state.weights ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  let weightTrend: number | null = null;
  if (weights.length >= 2) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const inW = weights.filter((w) => new Date(w.date) >= cutoff);
    if (inW.length >= 2) {
      weightTrend =
        Math.round((inW[inW.length - 1]!.weightKg - inW[0]!.weightKg) * 10) / 10;
    }
  }

  let proteinAdherence7d: number | null = null;
  if (profile) {
    const base = nutritionGoals(profile);
    let sum = 0;
    for (let i = 0; i < 7; i += 1) {
      const date = dateNDaysAgo(i);
      const totals = dayNutritionTotals(state.meals ?? [], date);
      sum += Math.min(1, totals.proteinG / Math.max(1, base.proteinG));
    }
    proteinAdherence7d = Math.round((sum / 7) * 100) / 100;
  }

  return {
    proteinAdherence7d,
    mealsLogged7d: meals7.length,
    weightTrendKg7d: weightTrend,
    latestWeightKg: weights.length ? weights[weights.length - 1]!.weightKg : null,
  };
}
