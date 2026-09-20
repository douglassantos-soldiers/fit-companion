import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { todayKey, type AppState } from "@/lib/types";
import type { MetricConfidence, Nutrition360 } from "@/lib/customer360/types";

function dateNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

function adherenceMetric(
  ratioSum: number,
  daysWithLogs: number,
  loggingCompleteness7d: number,
): MetricConfidence {
  const value =
    daysWithLogs > 0 ? Math.round((ratioSum / daysWithLogs) * 100) / 100 : null;
  let confidence = 0;
  let basis: MetricConfidence["basis"] = "none";
  if (daysWithLogs === 0) {
    confidence = 0;
    basis = "none";
  } else if (loggingCompleteness7d >= 0.85) {
    confidence = 0.9;
    basis = "full_logging";
  } else if (loggingCompleteness7d >= 0.4) {
    confidence = Math.round((0.4 + loggingCompleteness7d * 0.5) * 100) / 100;
    basis = "partial_logging";
  } else {
    confidence = Math.round(loggingCompleteness7d * 0.6 * 100) / 100;
    basis = "partial_logging";
  }
  return { value, confidence, basis };
}

/**
 * Separate logging completeness from nutrition adherence.
 * Days without meal logs do NOT count as 0 adherence — they lower confidence.
 */
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

  let daysLogged = 0;
  let proteinSum = 0;
  let kcalSum = 0;
  let proteinDays = 0;
  let kcalDays = 0;
  let proteinAcc = 0;
  let carbAcc = 0;
  let fatAcc = 0;

  if (profile) {
    const base = nutritionGoals(profile);
    for (let i = 0; i < 7; i += 1) {
      const date = dateNDaysAgo(i);
      const dayMeals = (state.meals ?? []).filter((m) => m.date === date);
      if (dayMeals.length > 0) {
        daysLogged += 1;
        const totals = dayNutritionTotals(state.meals ?? [], date);
        proteinSum += Math.min(1, totals.proteinG / Math.max(1, base.proteinG));
        proteinDays += 1;
        kcalSum += Math.min(1.2, totals.kcal / Math.max(1, base.kcal));
        kcalDays += 1;
        proteinAcc += totals.proteinG * 4;
        carbAcc += totals.carbG * 4;
        fatAcc += totals.fatG * 9;
      }
    }
  } else {
    for (let i = 0; i < 7; i += 1) {
      const date = dateNDaysAgo(i);
      if ((state.meals ?? []).some((m) => m.date === date)) daysLogged += 1;
    }
  }

  const loggingCompleteness7d = Math.round((daysLogged / 7) * 100) / 100;
  const proteinAdherence = adherenceMetric(proteinSum, proteinDays, loggingCompleteness7d);
  const kcalAdherence = adherenceMetric(kcalSum, kcalDays, loggingCompleteness7d);

  const macroKcal = proteinAcc + carbAcc + fatAcc;
  const macroDistribution7d =
    macroKcal > 0
      ? {
          protein: Math.round((proteinAcc / macroKcal) * 100) / 100,
          carb: Math.round((carbAcc / macroKcal) * 100) / 100,
          fat: Math.round((fatAcc / macroKcal) * 100) / 100,
        }
      : null;

  const mealFrequency7d = Math.round((meals7.length / 7) * 100) / 100;

  // Confidence from logging volume + share of estimated meals
  const estimatedShare =
    meals7.length === 0
      ? 0
      : meals7.filter((m) => m.sourceKind === "estimated" && !m.correctedFromAi).length / meals7.length;
  const nutritionConfidence =
    daysLogged === 0
      ? 0
      : Math.round(
          (proteinAdherence.confidence * 0.7 + (1 - estimatedShare) * 0.3) * 100,
        ) / 100;

  return {
    proteinAdherence7d: proteinAdherence.value,
    loggingCompleteness7d,
    proteinAdherence,
    kcalAdherence,
    macroDistribution7d,
    mealFrequency7d,
    nutritionConfidence,
    mealsLogged7d: meals7.length,
    weightTrendKg7d: weightTrend,
    latestWeightKg: weights.length ? weights[weights.length - 1]!.weightKg : null,
  };
}
