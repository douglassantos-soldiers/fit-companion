/**
 * Favorites / recents / saved meals (Fase 13 library).
 */
import { MEAL_PRESETS, type MealPreset } from "@/data/meal-presets";
import { recentMealPresets } from "@/lib/engine/nutrition";
import { foodById } from "@/lib/nutrition/food-catalog";
import { mealFromItems } from "@/lib/nutrition/meal-builder";
import type { FoodItem, MealItem } from "@/lib/nutrition/types";
import type { MealEntry, MealItemEntry, MealQuality, SavedMeal } from "@/lib/types";

export function savedMealFromEntry(entry: MealEntry): Omit<SavedMeal, "id" | "createdAt"> {
  const base: Omit<SavedMeal, "id" | "createdAt"> = {
    label: entry.label,
    items: entry.items ?? [],
    proteinG: entry.proteinG,
    kcal: entry.kcal,
    quality: entry.quality,
  };
  if (entry.carbG != null) base.carbG = entry.carbG;
  if (entry.fatG != null) base.fatG = entry.fatG;
  if (entry.fiberG != null) base.fiberG = entry.fiberG;
  return base;
}

export function upsertSavedMeal(list: SavedMeal[], meal: SavedMeal, cap = 40): SavedMeal[] {
  const without = list.filter((m) => m.id !== meal.id);
  return [meal, ...without].slice(0, cap);
}

export function removeSavedMealFromList(list: SavedMeal[], id: string): SavedMeal[] {
  return list.filter((m) => m.id !== id);
}

/** Recent composed/custom meals (newest first, unique by label). */
export function recentCustomMeals(meals: MealEntry[], limit = 8): MealEntry[] {
  const seen = new Set<string>();
  const out: MealEntry[] = [];
  for (const m of [...meals].reverse()) {
    if (!m.items?.length) continue;
    const key = m.label.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

/** Last logged catalog food ids (not only presets). */
export function recentFoodIds(meals: MealEntry[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [...meals].reverse()) {
    for (const item of m.items ?? []) {
      if (!item.foodId || item.foodId.startsWith("ean:") || seen.has(item.foodId)) continue;
      seen.add(item.foodId);
      out.push(item.foodId);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function recentFoodsFromMeals(meals: MealEntry[], limit = 8): FoodItem[] {
  return recentFoodIds(meals, limit)
    .map((id) => foodById(id))
    .filter((f): f is FoodItem => Boolean(f));
}

export function favoritePresets(favoriteIds: string[]): MealPreset[] {
  const set = new Set(favoriteIds);
  return MEAL_PRESETS.filter((p) => set.has(p.id));
}

export type NutritionLibrary = {
  favorites: MealPreset[];
  recentPresets: MealPreset[];
  recentCustom: MealEntry[];
  saved: SavedMeal[];
};

export function nutritionLibrary(
  meals: MealEntry[],
  favoriteIds: string[],
  saved: SavedMeal[],
): NutritionLibrary {
  return {
    favorites: favoritePresets(favoriteIds),
    recentPresets: recentMealPresets(meals, 8),
    recentCustom: recentCustomMeals(meals, 8),
    saved: [...saved].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export function customPickFromSaved(saved: SavedMeal): {
  label: string;
  proteinG: number;
  kcal: number;
  carbG?: number;
  fatG?: number;
  fiberG?: number;
  quality: MealQuality;
  items?: MealItemEntry[];
  sourceKind: "informed";
  foodSource: "user";
  nutrientSnapshot?: MealItemEntry["nutrientSnapshot"];
} {
  const pick: ReturnType<typeof customPickFromSaved> = {
    label: saved.label,
    proteinG: saved.proteinG,
    kcal: saved.kcal,
    quality: saved.quality,
    sourceKind: "informed",
    foodSource: "user",
  };
  if (saved.carbG != null) pick.carbG = saved.carbG;
  if (saved.fatG != null) pick.fatG = saved.fatG;
  if (saved.fiberG != null) pick.fiberG = saved.fiberG;
  if (saved.items.length) {
    pick.items = saved.items;
    const built = mealFromItems(saved.items as MealItem[], saved.label);
    pick.nutrientSnapshot = built.nutrientSnapshot as MealItemEntry["nutrientSnapshot"];
  }
  return pick;
}
