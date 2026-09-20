/**
 * Recipe engine — Recipe / RecipeItem with per-serving macros.
 */
import { RECIPE_SEEDS } from "@/data/recipes";
import { foodById } from "@/lib/nutrition/food-catalog";
import { buildMealItem, mealFromItems } from "@/lib/nutrition/meal-builder";
import { scaleMacros, sumMacros } from "@/lib/nutrition/nutrients";
import type { MacroSnapshot, MealItem, Recipe } from "@/lib/nutrition/types";

function hydrateRecipe(seed: (typeof RECIPE_SEEDS)[number]): Recipe {
  const parts: MacroSnapshot[] = [];
  for (const it of seed.items) {
    const food = foodById(it.foodId);
    if (!food) continue;
    parts.push(scaleMacros(food.per100g, it.grams / 100));
  }
  const recipe: Recipe = {
    id: seed.id,
    name: seed.name,
    servings: seed.servings,
    items: seed.items,
    totalMacros: sumMacros(parts),
    source: "internal",
  };
  if (seed.prepMinutes != null) recipe.prepMinutes = seed.prepMinutes;
  if (seed.cookMinutes != null) recipe.cookMinutes = seed.cookMinutes;
  if (seed.difficulty) recipe.difficulty = seed.difficulty;
  if (seed.tags) recipe.tags = seed.tags;
  return recipe;
}

let cache: Recipe[] | null = null;

export function allRecipes(): Recipe[] {
  if (!cache) cache = RECIPE_SEEDS.map(hydrateRecipe);
  return cache;
}

export function recipeById(id: string): Recipe | undefined {
  return allRecipes().find((r) => r.id === id);
}

export function recipeMacrosPerServing(recipe: Recipe): MacroSnapshot {
  const n = Math.max(1, recipe.servings);
  return scaleMacros(recipe.totalMacros, 1 / n);
}

/** Expand recipe into MealItems for one serving (or servings count). */
export function recipeToMealItems(recipeId: string, servings = 1): MealItem[] {
  const recipe = recipeById(recipeId);
  if (!recipe) return [];
  const factor = servings / Math.max(1, recipe.servings);
  const items: MealItem[] = [];
  for (const it of recipe.items) {
    const built = buildMealItem({
      foodId: it.foodId,
      quantity: it.quantity * factor,
      unit: it.unit,
      grams: it.grams * factor,
      sourceKind: "informed",
      foodSource: "internal",
      kind: "derived",
      confidence: 0.9,
    });
    if (built) items.push(built);
  }
  return items;
}

export function mealFromRecipe(recipeId: string, servings = 1) {
  const recipe = recipeById(recipeId);
  const items = recipeToMealItems(recipeId, servings);
  return mealFromItems(items, recipe?.name);
}
