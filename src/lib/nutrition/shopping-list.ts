/**
 * Shopping list from week meal plan (P1 diary loop).
 * Logged meal items + recipes mapped from suggested presets.
 */
import type { MealPreset } from "@/data/meal-presets";
import { foodById } from "@/lib/nutrition/food-catalog";
import type { DailyMealPlan } from "@/lib/nutrition/meal-planner";
import { recipeToMealItems } from "@/lib/nutrition/recipes";
import type { FoodCategory } from "@/lib/nutrition/types";
import type { MealEntry } from "@/lib/types";

/** presetId → recipeId for shopping expansion */
export const PRESET_TO_RECIPE: Record<string, string> = {
  "cafe-ovos": "recipe-ovos-pao",
  "cafe-whey": "recipe-whey-banana",
  "cafe-padaria": "recipe-cafe-pao-ovo",
  "almoco-carne": "recipe-patinho-arroz-feijao",
  "almoco-frango": "recipe-frango-arroz-feijao",
  "almoco-delivery": "recipe-burger-fritas",
  "almoco-marmita": "recipe-marmita-fit-almoco",
  "lanche-iogurte": "recipe-iogurte-granola",
  "lanche-whey": "recipe-whey-isolado-banana",
  "lanche-processado": "recipe-barra-maca",
  "lanche-castanhas": "recipe-iogurte-granola",
  "jantar-peixe": "recipe-tilapia-quinoa-brocolis",
  "jantar-leve": "recipe-omelete-salada",
  "jantar-pizza": "recipe-pizza-delivery",
  "qualquer-proteina": "recipe-wrap-frango-lanche",
  "qualquer-refeicao": "recipe-frango-arroz-feijao",
};

export type ShoppingLine = {
  key: string;
  foodId?: string;
  name: string;
  grams: number;
  category?: FoodCategory;
  /** Fallback when no foodId (opaque preset) */
  unit?: string;
  quantity?: number;
};

function addGrams(
  map: Map<string, ShoppingLine>,
  foodId: string,
  grams: number,
  fallbackName?: string,
) {
  const food = foodById(foodId);
  const name = food?.name ?? fallbackName ?? foodId;
  const key = foodId;
  const prev = map.get(key);
  if (prev) {
    prev.grams = Math.round((prev.grams + grams) * 10) / 10;
    return;
  }
  const line: ShoppingLine = {
    key,
    foodId,
    name,
    grams: Math.round(grams * 10) / 10,
  };
  if (food?.category) line.category = food.category;
  map.set(key, line);
}

function addOpaque(map: Map<string, ShoppingLine>, label: string) {
  const key = `opaque:${label}`;
  const prev = map.get(key);
  if (prev) {
    prev.quantity = (prev.quantity ?? 1) + 1;
    return;
  }
  map.set(key, {
    key,
    name: label,
    grams: 0,
    unit: "refeição",
    quantity: 1,
  });
}

export function recipeForPreset(preset: Pick<MealPreset, "id"> | { id: string }): string | null {
  return PRESET_TO_RECIPE[preset.id] ?? null;
}

/**
 * Aggregate shopping lines from a 7-day meal plan.
 * Prefer logged meal items; else expand suggested preset via recipe map.
 */
export function shoppingListFromWeekPlan(
  weekPlan: DailyMealPlan[],
  meals: MealEntry[] = [],
): ShoppingLine[] {
  const map = new Map<string, ShoppingLine>();

  for (const day of weekPlan) {
    for (const slot of day.slots) {
      if (slot.status === "skipped") continue;

      if (slot.status === "logged") {
        const dayMeals =
          slot.logged.length > 0
            ? slot.logged
            : meals.filter((m) => m.date === day.date && m.slot === slot.slot);
        for (const meal of dayMeals) {
          for (const item of meal.items ?? []) {
            if (item.foodId && !item.foodId.startsWith("ean:")) {
              addGrams(map, item.foodId, item.grams, item.foodName);
            } else if (item.foodName) {
              addOpaque(map, item.foodName);
            }
          }
          if (!meal.items?.length) addOpaque(map, meal.label);
        }
        continue;
      }

      // suggested
      if (slot.preset) {
        const recipeId = recipeForPreset(slot.preset);
        if (recipeId) {
          const items = recipeToMealItems(recipeId, slot.suggestedServings ?? 1);
          if (items.length) {
            for (const it of items) {
              addGrams(map, it.foodId, it.grams, it.foodName);
            }
            continue;
          }
        }
        addOpaque(map, slot.preset.label);
      }
    }
  }

  const CATEGORY_ORDER: FoodCategory[] = [
    "hortalicas",
    "frutas",
    "carnes",
    "aves",
    "peixes",
    "ovos",
    "laticinios",
    "cereais",
    "tuberculos",
    "leguminosas",
    "oleaginosas",
    "oleos",
    "bebidas",
    "suplementos",
    "industrializados",
    "outros",
  ];

  return [...map.values()].sort((a, b) => {
    const ca = a.category ? CATEGORY_ORDER.indexOf(a.category) : 99;
    const cb = b.category ? CATEGORY_ORDER.indexOf(b.category) : 99;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function shoppingListToText(lines: ShoppingLine[]): string {
  return lines
    .map((l) => {
      if (l.foodId && l.grams > 0) return `• ${l.name} — ${Math.round(l.grams)} g`;
      const q = l.quantity ?? 1;
      return q > 1 ? `• ${l.name} — ${q} × refeição` : `• ${l.name} — 1 × refeição`;
    })
    .join("\n");
}
