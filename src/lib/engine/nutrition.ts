import { MEAL_PRESETS, presetsForSlot, type MealPreset } from "@/data/meal-presets";
import type { LearningInsights } from "@/lib/engine/learning";
import type { AppState, Goal, MealEntry, MealQuality, MealSlot, Profile } from "@/lib/types";
import { todayKey } from "@/lib/types";

export interface NutritionGoals {
  kcal: number;
  proteinG: number;
  mealsTarget: number;
  waterMl: number;
}

export interface MealPlanSlot {
  slot: MealSlot;
  status: "suggested" | "logged";
  preset: MealPreset | null;
  logged: MealEntry[];
}

export interface DailyMealPlan {
  date: string;
  slots: MealPlanSlot[];
  goals: NutritionGoals;
  projectedProteinG: number;
  projectedKcal: number;
}

const SLOTS: MealSlot[] = ["cafe", "almoco", "lanche", "jantar"];

const PROTEIN_PER_KG: Record<Goal, number> = {
  massa: 2.0,
  gordura: 2.2,
  performance: 1.8,
  saude: 1.6,
};

const KCAL_PER_KG: Record<Goal, number> = {
  massa: 36,
  gordura: 28,
  performance: 34,
  saude: 30,
};

export function nutritionGoals(profile: Profile, insights?: LearningInsights | null): NutritionGoals {
  let proteinG = Math.round(profile.weightKg * PROTEIN_PER_KG[profile.goal]);
  let kcal = Math.round(profile.weightKg * KCAL_PER_KG[profile.goal]);

  if (insights?.adaptations.kcalDelta) {
    kcal = Math.max(1400, kcal + insights.adaptations.kcalDelta);
  }
  if (insights?.adaptations.proteinBias === "up") {
    proteinG = Math.round(proteinG * 1.1);
  }

  return {
    proteinG,
    kcal,
    mealsTarget: 4,
    waterMl: Math.max(2500, Math.round(profile.weightKg * 35)),
  };
}

export function mealsOnDate(meals: MealEntry[], date = todayKey()) {
  return meals.filter((m) => m.date === date);
}

export function dayNutritionTotals(meals: MealEntry[], date = todayKey()) {
  const day = mealsOnDate(meals, date);
  return {
    proteinG: Math.round(day.reduce((s, m) => s + m.proteinG, 0)),
    kcal: Math.round(day.reduce((s, m) => s + m.kcal, 0)),
    count: day.length,
    bySlot: Object.fromEntries(
      SLOTS.map((slot) => [slot, day.filter((m) => m.slot === slot)]),
    ) as Record<MealSlot, MealEntry[]>,
  };
}

/** Scale preset macros by servings (0.5–3 typical). */
export function scalePreset(preset: MealPreset, servings: number) {
  const s = Math.max(0.25, servings);
  return {
    proteinG: Math.round(preset.proteinG * s),
    kcal: Math.round(preset.kcal * s),
  };
}

/** Build a meal entry payload from a preset (caller persists via store). */
export function addMealFromPreset(preset: MealPreset, slot: MealSlot, servings = 1) {
  const scaled = scalePreset(preset, servings);
  return {
    slot,
    label: preset.label,
    proteinG: scaled.proteinG,
    kcal: scaled.kcal,
    quality: preset.quality,
    presetId: preset.id,
    servings,
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
  const out: { label: string; date: string; proteinG: number; meals: number; kcal: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = todayKey(d);
    const totals = dayNutritionTotals(meals, date);
    out.push({
      date,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      proteinG: totals.proteinG,
      meals: totals.count,
      kcal: totals.kcal,
    });
  }
  return out;
}

export function suggestSlot(now = new Date()): MealSlot {
  const h = now.getHours();
  if (h < 11) return "cafe";
  if (h < 15) return "almoco";
  if (h < 18) return "lanche";
  return "jantar";
}

function yesterdayKey(date: string) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function pickPresetForSlot(
  slot: MealSlot,
  preferGreen: boolean,
  avoidIds: Set<string>,
  remainingProtein: number,
): MealPreset {
  const pool = presetsForSlot(slot);
  const ranked = [...pool].sort((a, b) => {
    const greenA = a.quality === "verde" ? 1 : 0;
    const greenB = b.quality === "verde" ? 1 : 0;
    if (preferGreen && greenA !== greenB) return greenB - greenA;
    const avoidA = avoidIds.has(a.id) ? 1 : 0;
    const avoidB = avoidIds.has(b.id) ? 1 : 0;
    if (avoidA !== avoidB) return avoidA - avoidB;
    // Prefer higher protein when still below target
    if (remainingProtein > 0) return b.proteinG - a.proteinG;
    return a.kcal - b.kcal;
  });
  return ranked[0] ?? MEAL_PRESETS[0]!;
}

/** Plano do dia: slots logados + presets sugeridos até cobrir metas. */
export function buildDailyMealPlan(
  profile: Profile,
  state: AppState,
  date = todayKey(),
  insights?: LearningInsights | null,
): DailyMealPlan {
  const goals = nutritionGoals(profile, insights);
  const totals = dayNutritionTotals(state.meals ?? [], date);
  const yKey = yesterdayKey(date);
  const yesterdayIds = new Set(
    mealsOnDate(state.meals ?? [], yKey)
      .map((m) => m.presetId)
      .filter((id): id is string => Boolean(id)),
  );
  const preferGreen = insights?.adaptations.preferGreenMeals ?? false;

  let projectedProtein = 0;
  let projectedKcal = 0;
  const slots: MealPlanSlot[] = [];

  for (const slot of SLOTS) {
    const logged = totals.bySlot[slot] ?? [];
    if (logged.length > 0) {
      projectedProtein += logged.reduce((s, m) => s + m.proteinG, 0);
      projectedKcal += logged.reduce((s, m) => s + m.kcal, 0);
      slots.push({ slot, status: "logged", preset: null, logged });
      continue;
    }
    const remainingProtein = goals.proteinG - projectedProtein;
    const preset = pickPresetForSlot(slot, preferGreen, yesterdayIds, remainingProtein);
    projectedProtein += preset.proteinG;
    projectedKcal += preset.kcal;
    slots.push({ slot, status: "suggested", preset, logged: [] });
  }

  return {
    date,
    slots,
    goals,
    projectedProteinG: Math.round(projectedProtein),
    projectedKcal: Math.round(projectedKcal),
  };
}

export function nextSuggestedMeal(plan: DailyMealPlan, now = new Date()): MealPlanSlot | null {
  const preferred = suggestSlot(now);
  const preferredSlot = plan.slots.find((s) => s.slot === preferred && s.status === "suggested");
  if (preferredSlot) return preferredSlot;
  return plan.slots.find((s) => s.status === "suggested") ?? null;
}

export const QUALITY_LABEL: Record<MealQuality, string> = {
  verde: "Mais nutritivo",
  amarelo: "Equilibrado",
  laranja: "Ocasional",
};
