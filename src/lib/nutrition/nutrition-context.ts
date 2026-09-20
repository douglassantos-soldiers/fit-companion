/**
 * Nutrition context — daily totals, gaps, confidence for UI/planner.
 */
import { ALL_MEAL_SLOTS } from "@/lib/engine/nutrition-profile";
import { macroDistribution, sumMacros } from "@/lib/nutrition/nutrients";
import type { MacroSnapshot } from "@/lib/nutrition/types";
import type { MealEntry, MealSlot } from "@/lib/types";
import { todayKey } from "@/lib/types";

export function mealsOnDate(meals: MealEntry[], date = todayKey()) {
  return meals.filter((m) => m.date === date);
}

export function entryMacros(entry: MealEntry): MacroSnapshot {
  if (entry.nutrientSnapshot) {
    const m: MacroSnapshot = {
      energyKcal: entry.nutrientSnapshot.energyKcal,
      proteinG: entry.nutrientSnapshot.proteinG,
      carbG: entry.nutrientSnapshot.carbG,
      fatG: entry.nutrientSnapshot.fatG,
    };
    if (entry.nutrientSnapshot.fiberG != null) m.fiberG = entry.nutrientSnapshot.fiberG;
    if (entry.nutrientSnapshot.sugarG != null) m.sugarG = entry.nutrientSnapshot.sugarG;
    if (entry.nutrientSnapshot.sodiumMg != null) m.sodiumMg = entry.nutrientSnapshot.sodiumMg;
    return m;
  }
  if (entry.items?.length) {
    return sumMacros(entry.items.map((i) => i.nutrientSnapshot));
  }
  return {
    energyKcal: entry.kcal,
    proteinG: entry.proteinG,
    carbG: entry.carbG ?? 0,
    fatG: entry.fatG ?? 0,
    fiberG: entry.fiberG ?? 0,
  };
}

export function dayMealTotals(meals: MealEntry[], date = todayKey()) {
  const day = mealsOnDate(meals, date);
  const macros = sumMacros(day.map(entryMacros));
  return {
    proteinG: Math.round(macros.proteinG),
    carbG: Math.round(macros.carbG),
    fatG: Math.round(macros.fatG),
    fiberG: Math.round(macros.fiberG ?? 0),
    kcal: Math.round(macros.energyKcal),
    count: day.length,
    bySlot: Object.fromEntries(
      ALL_MEAL_SLOTS.map((slot) => [slot, day.filter((m) => m.slot === slot)]),
    ) as Record<MealSlot, MealEntry[]>,
    macros,
    distribution: macroDistribution(macros),
  };
}

export type NutritionDayContext = {
  date: string;
  totals: ReturnType<typeof dayMealTotals>;
  goals: { proteinG: number; kcal: number; carbG?: number; fatG?: number; waterMl: number };
  gaps: { proteinG: number; kcal: number; carbG: number; fatG: number };
  loggingConfidence: number;
  estimatedShare: number;
};

export function buildNutritionContext(
  meals: MealEntry[],
  goals: { proteinG: number; kcal: number; carbG?: number; fatG?: number; waterMl: number },
  date = todayKey(),
): NutritionDayContext {
  const totals = dayMealTotals(meals, date);
  const day = mealsOnDate(meals, date);
  const estimated = day.filter((m) => m.sourceKind === "estimated" && !m.correctedFromAi).length;
  const estimatedShare = day.length ? estimated / day.length : 0;
  const loggingConfidence =
    day.length === 0 ? 0 : Math.round((1 - estimatedShare * 0.4) * (Math.min(1, day.length / 3)) * 100) / 100;

  return {
    date,
    totals,
    goals,
    gaps: {
      proteinG: Math.max(0, goals.proteinG - totals.proteinG),
      kcal: Math.max(0, goals.kcal - totals.kcal),
      carbG: Math.max(0, (goals.carbG ?? 0) - totals.carbG),
      fatG: Math.max(0, (goals.fatG ?? 0) - totals.fatG),
    },
    loggingConfidence,
    estimatedShare,
  };
}
