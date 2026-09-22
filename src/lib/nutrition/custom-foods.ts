/**
 * User custom foods — AppState retention → catalog overlay (P2).
 */
import { parseEan } from "@/lib/nutrition/barcode";
import { nutrientValue } from "@/lib/nutrition/nutrients";
import type { FoodCategory, FoodItem, FoodServing, MacroSnapshot } from "@/lib/nutrition/types";
import type { CustomFood } from "@/lib/types";

export const CUSTOM_FOOD_CAP = 60;

export function newCustomFoodId(): string {
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function validateCustomFoodEan(raw: string | undefined | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const parsed = parseEan(raw);
  return parsed ?? undefined;
}

export function customFoodToPer100g(f: CustomFood): MacroSnapshot {
  const out: MacroSnapshot = {
    energyKcal: f.kcal,
    proteinG: f.proteinG,
    carbG: f.carbG,
    fatG: f.fatG,
  };
  if (f.fiberG != null) out.fiberG = f.fiberG;
  if (f.sodiumMg != null) out.sodiumMg = f.sodiumMg;
  const extras: NonNullable<MacroSnapshot["extras"]> = {};
  if (f.ironMg != null && f.ironMg > 0) {
    extras.ironMg = nutrientValue("ironMg", f.ironMg, "mg", "user", "observed", 0.85);
  }
  if (f.vitaminDUcg != null && f.vitaminDUcg > 0) {
    extras.vitaminDUcg = nutrientValue("vitaminDUcg", f.vitaminDUcg, "µg", "user", "observed", 0.85);
  }
  if (Object.keys(extras).length) out.extras = extras;
  return out;
}

export function customFoodToItem(f: CustomFood): FoodItem {
  const item: FoodItem = {
    id: f.id,
    name: f.name,
    category: f.category,
    source: "user",
    servingReference: `${f.id}:serving`,
    active: true,
    confidence: 0.9,
    per100g: customFoodToPer100g(f),
  };
  if (f.brand) item.brand = f.brand;
  if (f.ean) item.ean = f.ean;
  item.synonyms = ["meu alimento", "custom", f.name];
  return item;
}

export function customFoodToServing(f: CustomFood): FoodServing {
  return {
    id: `${f.id}:serving`,
    foodId: f.id,
    label: f.servingLabel || "1 porção",
    gramsEquivalent: Math.max(1, f.servingGrams),
    isDefault: true,
  };
}

export function customFoodsToCatalog(list: CustomFood[]): {
  items: FoodItem[];
  servings: FoodServing[];
} {
  const items = list.map(customFoodToItem);
  const servings = list.map(customFoodToServing);
  return { items, servings };
}

export function upsertCustomFoodList(
  list: CustomFood[],
  food: CustomFood,
  cap = CUSTOM_FOOD_CAP,
): CustomFood[] {
  const rest = list.filter((x) => x.id !== food.id);
  return [food, ...rest].slice(0, cap);
}

export function removeCustomFoodFromList(list: CustomFood[], id: string): CustomFood[] {
  return list.filter((x) => x.id !== id);
}

export type CustomFoodInput = {
  id?: string;
  name: string;
  brand?: string;
  category: FoodCategory;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG?: number;
  sodiumMg?: number;
  ironMg?: number;
  vitaminDUcg?: number;
  servingLabel: string;
  servingGrams: number;
  ean?: string;
};

export function buildCustomFood(input: CustomFoodInput, now = new Date().toISOString()): CustomFood {
  const ean = validateCustomFoodEan(input.ean);
  const food: CustomFood = {
    id: input.id?.startsWith("user-") ? input.id : newCustomFoodId(),
    name: input.name.trim(),
    category: input.category,
    kcal: Math.max(0, input.kcal),
    proteinG: Math.max(0, input.proteinG),
    carbG: Math.max(0, input.carbG),
    fatG: Math.max(0, input.fatG),
    servingLabel: input.servingLabel.trim() || "1 porção",
    servingGrams: Math.max(1, input.servingGrams),
    createdAt: now,
    updatedAt: now,
  };
  if (input.brand?.trim()) food.brand = input.brand.trim();
  if (input.fiberG != null) food.fiberG = input.fiberG;
  if (input.sodiumMg != null) food.sodiumMg = input.sodiumMg;
  if (input.ironMg != null) food.ironMg = input.ironMg;
  if (input.vitaminDUcg != null) food.vitaminDUcg = input.vitaminDUcg;
  if (ean) food.ean = ean;
  return food;
}
