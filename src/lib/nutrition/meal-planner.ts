/**
 * Daily meal planner + 7-day suggestion loop (Fase 13).
 */
import { MEAL_PRESETS, presetsForSlot, type MealPreset } from "@/data/meal-presets";
import type { LearningInsights } from "@/lib/engine/learning";
import {
  activeMealSlots,
  ALL_MEAL_SLOTS,
  redistributionFactor,
} from "@/lib/engine/nutrition-profile";
import { dayMealTotals } from "@/lib/nutrition/nutrition-context";
import type { AppState, Goal, MealEntry, MealSlot, Profile, TrainingMode } from "@/lib/types";
import { todayKey } from "@/lib/types";

export interface NutritionGoals {
  kcal: number;
  proteinG: number;
  carbG?: number;
  fatG?: number;
  mealsTarget: number;
  waterMl: number;
}

export interface MealPlanSlot {
  slot: MealSlot;
  status: "suggested" | "logged" | "skipped";
  preset: MealPreset | null;
  logged: MealEntry[];
  suggestedServings?: number;
}

export interface DailyMealPlan {
  date: string;
  slots: MealPlanSlot[];
  goals: NutritionGoals;
  projectedProteinG: number;
  projectedKcal: number;
  projectedCarbG?: number;
  projectedFatG?: number;
  redistributed: boolean;
}

export type MealPlanEngineOpts = {
  calorieDelta?: number;
  proteinBias?: "up" | "hold";
  mealDistribution?: "rebalanced" | "default";
  trainingMode?: TrainingMode;
  lunchOutToday?: boolean;
  skippedSlots?: MealSlot[];
  favoritePresetIds?: string[];
};

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

export function computeNutritionGoals(
  profile: Profile,
  insights?: LearningInsights | null,
  engine?: Pick<MealPlanEngineOpts, "calorieDelta" | "proteinBias">,
): NutritionGoals {
  const weightKg = profile.weightKg >= 35 ? profile.weightKg : 75;
  let proteinG = Math.round(weightKg * PROTEIN_PER_KG[profile.goal]);
  let kcal = Math.round(weightKg * KCAL_PER_KG[profile.goal]);

  if (insights?.adaptations.proteinBias === "up") {
    proteinG = Math.round(proteinG * 1.1);
  }
  // Weekly kcal delta is applied once via Decision / engine.calorieDelta — not here.
  if (engine?.calorieDelta) {
    kcal = Math.max(1400, kcal + engine.calorieDelta);
  }
  if (engine?.proteinBias === "up") {
    proteinG = Math.round(proteinG * 1.05);
  }

  // Soft macro targets (architecture for future planner)
  const carbG = Math.round((kcal * 0.45) / 4);
  const fatG = Math.round((kcal * 0.25) / 9);

  const slots = activeMealSlots(profile);
  return {
    proteinG,
    kcal,
    carbG,
    fatG,
    mealsTarget: Math.max(1, slots.length),
    waterMl: Math.max(2500, Math.round(weightKg * 35)),
  };
}

function yesterdayKey(date: string) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function matchesRestrictions(preset: MealPreset, restrictions: string[]): boolean {
  if (!restrictions.length) return true;
  const label = preset.label.toLowerCase();
  for (const r of restrictions) {
    const n = r.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (!n) continue;
    if (n.includes("lactose") || n.includes("leite") || n.includes("latic")) {
      if (/iogurte|queijo|leite|whey|padaria/i.test(label)) return false;
    }
    if (n.includes("gluten") || n.includes("glúten")) {
      if (/p[aã]o|macarr|padaria|wrap/i.test(label)) return false;
    }
    if (n.includes("carne") && /carne|bife/i.test(label)) return false;
    if ((n.includes("porco") || n.includes("suino")) && /porco|bacon/i.test(label)) return false;
  }
  return true;
}

function prefersFood(preset: MealPreset, preferences: string[]): number {
  if (!preferences.length) return 0;
  const label = preset.label.toLowerCase();
  let score = 0;
  for (const p of preferences) {
    const n = p.toLowerCase();
    if (n && label.includes(n)) score += 1;
  }
  return score;
}

function pickPresetForSlot(
  slot: MealSlot,
  preferGreen: boolean,
  avoidIds: Set<string>,
  remainingProtein: number,
  preferPractical: boolean,
  restrictions: string[],
  preferences: string[],
  favoriteIds: Set<string>,
): MealPreset {
  const pool = presetsForSlot(slot).filter((p) => matchesRestrictions(p, restrictions));
  const ranked = [...(pool.length ? pool : presetsForSlot(slot))].sort((a, b) => {
    const favA = favoriteIds.has(a.id) ? 1 : 0;
    const favB = favoriteIds.has(b.id) ? 1 : 0;
    if (favA !== favB) return favB - favA;
    const prefDiff = prefersFood(b, preferences) - prefersFood(a, preferences);
    if (prefDiff !== 0) return prefDiff;
    const greenA = a.quality === "verde" ? 1 : 0;
    const greenB = b.quality === "verde" ? 1 : 0;
    if (preferGreen && greenA !== greenB) return greenB - greenA;
    const avoidA = avoidIds.has(a.id) ? 1 : 0;
    const avoidB = avoidIds.has(b.id) ? 1 : 0;
    if (avoidA !== avoidB) return avoidA - avoidB;
    if (preferPractical) {
      const kcalDiff = a.kcal - b.kcal;
      if (kcalDiff !== 0) return kcalDiff;
    }
    if (remainingProtein > 0) return b.proteinG - a.proteinG;
    return a.kcal - b.kcal;
  });
  return ranked[0] ?? MEAL_PRESETS[0]!;
}

export function scalePreset(preset: MealPreset, servings: number) {
  const s = Math.max(0.25, servings);
  return {
    proteinG: Math.round(preset.proteinG * s),
    kcal: Math.round(preset.kcal * s),
    carbG: Math.round((preset as MealPreset & { carbG?: number }).carbG ?? preset.kcal * 0.1 * s),
    fatG: Math.round((preset as MealPreset & { fatG?: number }).fatG ?? preset.kcal * 0.03 * s),
  };
}

/**
 * Build daily meal plan considering goal, targets, preferences,
 * restrictions, schedule (active slots), available presets, logged meals.
 */
export function buildDailyMealPlanCore(
  profile: Profile,
  state: AppState,
  date = todayKey(),
  insights?: LearningInsights | null,
  engine?: MealPlanEngineOpts,
): DailyMealPlan {
  const goals = computeNutritionGoals(profile, insights, engine);
  const skippedToday = new Set(engine?.skippedSlots ?? []);
  const active = activeMealSlots(profile).filter((s) => !skippedToday.has(s));
  const redistributed = active.length < ALL_MEAL_SLOTS.length;
  const scale = redistributionFactor(Math.max(1, active.length));
  let suggestedServings = Math.min(2.5, Math.round(scale * 4) / 4);
  if (engine?.mealDistribution === "rebalanced") {
    suggestedServings = Math.min(2.5, suggestedServings + 0.25);
  }

  const totals = dayMealTotals(state.meals ?? [], date);
  const yKey = yesterdayKey(date);
  const yesterdayIds = new Set(
    (state.meals ?? [])
      .filter((m) => m.date === yKey)
      .map((m) => m.presetId)
      .filter((id): id is string => Boolean(id)),
  );
  const preferGreen = insights?.adaptations.preferGreenMeals ?? false;
  const np = profile.nutritionProfile;
  const preferPractical =
    engine?.lunchOutToday === true ||
    np?.eatsOutFrequency === "frequente" ||
    profile.lunchOutOften === true ||
    np?.eatingDifficulty === "alta" ||
    np?.budgetLevel === "baixo";
  const restrictions = [...(np?.foodRestrictions ?? [])];
  const preferences = np?.foodPreferences ?? [];
  const favoriteIds = new Set(engine?.favoritePresetIds ?? []);

  // Schedule: prefer slots whose mealWindows are enabled
  const windows = np?.mealWindows;

  let projectedProtein = 0;
  let projectedKcal = 0;
  let projectedCarb = 0;
  let projectedFat = 0;
  const slots: MealPlanSlot[] = [];

  for (const slot of ALL_MEAL_SLOTS) {
    const logged = totals.bySlot[slot] ?? [];
    const windowEnabled = windows?.[slot]?.enabled;
    const slotActive = active.includes(slot) && windowEnabled !== false;

    if (!slotActive) {
      if (logged.length > 0) {
        projectedProtein += logged.reduce((s, m) => s + m.proteinG, 0);
        projectedKcal += logged.reduce((s, m) => s + m.kcal, 0);
        projectedCarb += logged.reduce((s, m) => s + (m.carbG ?? 0), 0);
        projectedFat += logged.reduce((s, m) => s + (m.fatG ?? 0), 0);
        slots.push({ slot, status: "logged", preset: null, logged });
      } else {
        slots.push({ slot, status: "skipped", preset: null, logged: [] });
      }
      continue;
    }

    if (logged.length > 0) {
      projectedProtein += logged.reduce((s, m) => s + m.proteinG, 0);
      projectedKcal += logged.reduce((s, m) => s + m.kcal, 0);
      projectedCarb += logged.reduce((s, m) => s + (m.carbG ?? 0), 0);
      projectedFat += logged.reduce((s, m) => s + (m.fatG ?? 0), 0);
      slots.push({ slot, status: "logged", preset: null, logged });
      continue;
    }

    const remainingProtein = goals.proteinG - projectedProtein;
    const preset = pickPresetForSlot(
      slot,
      preferGreen,
      yesterdayIds,
      remainingProtein,
      preferPractical,
      restrictions,
      preferences,
      favoriteIds,
    );
    const extraPost =
      engine?.trainingMode && engine.trainingMode !== "rest" && slot === "lanche" ? 0.25 : 0;
    const slotServings = Math.min(2.5, suggestedServings + extraPost);
    const scaled = scalePreset(preset, slotServings);
    projectedProtein += scaled.proteinG;
    projectedKcal += scaled.kcal;
    projectedCarb += scaled.carbG;
    projectedFat += scaled.fatG;
    slots.push({
      slot,
      status: "suggested",
      preset,
      logged: [],
      suggestedServings: slotServings,
    });
  }

  return {
    date,
    slots,
    goals,
    projectedProteinG: Math.round(projectedProtein),
    projectedKcal: Math.round(projectedKcal),
    projectedCarbG: Math.round(projectedCarb),
    projectedFatG: Math.round(projectedFat),
    redistributed,
  };
}

export function shiftDateKey(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

/**
 * Suggested meals for the next `days` (default 7). Not a log — each day reuses the daily core
 * with that date's check-in / living snapshot when present.
 */
export function buildMultiDayMealPlan(
  profile: Profile,
  state: AppState,
  startDate = todayKey(),
  days = 7,
  insights?: LearningInsights | null,
): DailyMealPlan[] {
  const n = Math.max(1, Math.min(14, Math.round(days)));
  const out: DailyMealPlan[] = [];
  for (let i = 0; i < n; i++) {
    const date = shiftDateKey(startDate, i);
    const check = state.dayCheckIns?.[date];
    const living = state.livingPlans?.[date];
    const engine: MealPlanEngineOpts = {};
    if (check?.lunchOutToday) engine.lunchOutToday = true;
    if (check?.skippedSlots?.length) engine.skippedSlots = check.skippedSlots;
    if (state.favoriteMealPresetIds?.length) engine.favoritePresetIds = state.favoriteMealPresetIds;
    if (living?.workout.mode) engine.trainingMode = living.workout.mode;
    out.push(buildDailyMealPlanCore(profile, state, date, insights, engine));
  }
  return out;
}
