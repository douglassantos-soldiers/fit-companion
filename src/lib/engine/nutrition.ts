import { MEAL_PRESETS, type MealPreset } from "@/data/meal-presets";
import type { LearningInsights } from "@/lib/engine/learning";
import { ALL_MEAL_SLOTS } from "@/lib/engine/nutrition-profile";
import {
  buildDailyMealPlanCore,
  buildMultiDayMealPlan,
  computeNutritionGoals,
  scalePreset as scalePresetCore,
  shiftDateKey,
  type DailyMealPlan,
  type MealPlanEngineOpts,
  type MealPlanSlot,
  type NutritionGoals,
} from "@/lib/nutrition/meal-planner";
import { mealPlanOptsFromState } from "@/lib/nutrition/plan-opts";
import { wheyMacrosFromDoses } from "@/lib/nutrition/whey";
import { dayMealTotals, mealsOnDate } from "@/lib/nutrition/nutrition-context";
import type { AppState, MealEntry, MealQuality, MealSlot, Profile } from "@/lib/types";
import { todayKey } from "@/lib/types";

export type { NutritionGoals, MealPlanSlot, DailyMealPlan, MealPlanEngineOpts };

/** Facade → nutrition domain */
export function nutritionGoals(
  profile: Profile,
  insights?: LearningInsights | null,
  engine?: Pick<MealPlanEngineOpts, "calorieDelta" | "proteinBias">,
): NutritionGoals {
  return computeNutritionGoals(profile, insights, engine);
}

export { buildDailyMealPlanCore, buildMultiDayMealPlan, mealsOnDate, shiftDateKey };

export function dayNutritionTotals(
  meals: MealEntry[],
  date = todayKey(),
  extra?: { proteinG: number; kcal: number },
) {
  const t = dayMealTotals(meals, date);
  return {
    proteinG: t.proteinG + (extra?.proteinG ?? 0),
    carbG: t.carbG,
    fatG: t.fatG,
    fiberG: t.fiberG,
    kcal: t.kcal + (extra?.kcal ?? 0),
    count: t.count,
    bySlot: t.bySlot,
  };
}

export function dayNutritionTotalsFromState(state: AppState, date = todayKey()) {
  const whey = wheyMacrosFromDoses(
    state.supplementDoseLogs,
    date,
    state.profile?.nutritionProfile?.countWheyInMacros === true,
  );
  return dayNutritionTotals(state.meals ?? [], date, whey);
}

/** Scale preset macros by servings (0.25–3 typical). */
export function scalePreset(preset: MealPreset, servings: number) {
  return scalePresetCore(preset, servings);
}

/** Build a meal entry payload from a preset (caller persists via store). */
export function addMealFromPreset(preset: MealPreset, slot: MealSlot, servings = 1) {
  const scaled = scalePreset(preset, servings);
  return {
    slot,
    label: preset.label,
    proteinG: scaled.proteinG,
    kcal: scaled.kcal,
    carbG: scaled.carbG,
    fatG: scaled.fatG,
    quality: preset.quality,
    presetId: preset.id,
    servings,
    sourceKind: "informed" as const,
    confidence: 1,
    foodSource: "internal" as const,
  };
}

/** Recent presets from meal history (newest first, unique). */
export function recentMealPresets(meals: MealEntry[], limit = 8): MealPreset[] {
  const seen = new Set<string>();
  const out: MealPreset[] = [];
  for (const m of [...meals].reverse()) {
    if (!m.presetId || seen.has(m.presetId)) continue;
    const preset = MEAL_PRESETS.find((p) => p.id === m.presetId);
    if (!preset) continue;
    seen.add(m.presetId);
    out.push(preset);
    if (out.length >= limit) break;
  }
  return out;
}

export function weeklyNutritionSeries(meals: MealEntry[], days = 7) {
  const out: {
    label: string;
    date: string;
    proteinG: number;
    carbG: number;
    fatG: number;
    meals: number;
    kcal: number;
  }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = todayKey(d);
    const totals = dayNutritionTotals(meals, date);
    out.push({
      date,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      proteinG: totals.proteinG,
      carbG: totals.carbG,
      fatG: totals.fatG,
      meals: totals.count,
      kcal: totals.kcal,
    });
  }
  return out;
}

export function suggestSlot(now = new Date(), active?: MealSlot[]): MealSlot {
  const h = now.getHours();
  let preferred: MealSlot = "jantar";
  if (h < 11) preferred = "cafe";
  else if (h < 15) preferred = "almoco";
  else if (h < 18) preferred = "lanche";

  if (!active?.length) return preferred;
  if (active.includes(preferred)) return preferred;
  const order = ALL_MEAL_SLOTS.filter((s) => active.includes(s));
  const idx = ALL_MEAL_SLOTS.indexOf(preferred);
  for (let i = idx; i < ALL_MEAL_SLOTS.length; i += 1) {
    const s = ALL_MEAL_SLOTS[i]!;
    if (active.includes(s)) return s;
  }
  for (let i = idx; i >= 0; i -= 1) {
    const s = ALL_MEAL_SLOTS[i]!;
    if (active.includes(s)) return s;
  }
  return order[0] ?? preferred;
}

/** Plano do dia — delega ao meal-planner (prefs, restrictions, macros). */
export function buildDailyMealPlan(
  profile: Profile,
  state: AppState,
  date = todayKey(),
  insights?: LearningInsights | null,
  engine?: MealPlanEngineOpts,
): DailyMealPlan {
  return buildDailyMealPlanCore(profile, state, date, insights, engine ?? mealPlanOptsFromState(state, date));
}

export function nextSuggestedMeal(
  plan: DailyMealPlan,
  now = new Date(),
  active?: MealSlot[],
): MealPlanSlot | null {
  const preferred = suggestSlot(now, active);
  const preferredSlot = plan.slots.find((s) => s.slot === preferred && s.status === "suggested");
  if (preferredSlot) return preferredSlot;
  return plan.slots.find((s) => s.status === "suggested") ?? null;
}

export const QUALITY_LABEL: Record<MealQuality, string> = {
  verde: "Mais nutritivo",
  amarelo: "Equilibrado",
  laranja: "Ocasional",
};

/** Provenance badge label for UI. */
export function mealProvenanceLabel(entry: MealEntry): string {
  if (entry.sourceKind === "informed" || entry.correctedFromAi) {
    return entry.correctedFromAi ? "Informado (corrigido)" : "Informado";
  }
  if (entry.sourceKind === "estimated") {
    const pct = Math.round((entry.confidence ?? 0.5) * 100);
    return `Estimativa IA (${pct}%)`;
  }
  return "Informado";
}
