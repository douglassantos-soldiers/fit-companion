/**
 * Food catalog — indexed view over src/data/foods.ts, optionally merged with licensed TACO.
 */
import { FOOD_ITEMS, FOOD_SERVINGS } from "@/data/foods";
import type { FoodItem, FoodServing } from "@/lib/nutrition/types";

function eanDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 12 || digits.length === 13) return digits;
  return null;
}

let items: FoodItem[] = [...FOOD_ITEMS];
let servings: FoodServing[] = [...FOOD_SERVINGS];
let byId = new Map<string, FoodItem>();
let byEan = new Map<string, FoodItem>();
let servingsByFood = new Map<string, FoodServing[]>();

function rebuild() {
  byId = new Map(items.map((f) => [f.id, f]));
  byEan = new Map();
  for (const f of items) {
    if (!f.ean) continue;
    const ean = eanDigits(f.ean);
    if (ean) byEan.set(ean, f);
  }
  servingsByFood = new Map();
  for (const s of servings) {
    const list = servingsByFood.get(s.foodId) ?? [];
    list.push(s);
    servingsByFood.set(s.foodId, list);
  }
}

rebuild();

export function replaceFoodCatalog(nextItems: FoodItem[], nextServings: FoodServing[]): void {
  items = [...nextItems];
  servings = [...nextServings];
  rebuild();
}

/** Restore authored internal catalog (tests / no TACO license). */
export function resetFoodCatalog(): void {
  replaceFoodCatalog([...FOOD_ITEMS], [...FOOD_SERVINGS]);
}

/**
 * Merge licensed TACO rows onto the internal seed. Without the flag, TACO is ignored.
 */
export function applyTacoCatalog(opts: {
  tacoLicenseVerified: boolean;
  tacoFoods: FoodItem[];
  tacoServings: FoodServing[];
}): void {
  if (!opts.tacoLicenseVerified) {
    resetFoodCatalog();
    return;
  }
  const taco = opts.tacoFoods.filter((f) => f.source === "taco" && f.active !== false);
  const tacoIds = new Set(taco.map((f) => f.id));
  const mergedItems = [...FOOD_ITEMS.filter((f) => !tacoIds.has(f.id)), ...taco];
  const tacoServings = opts.tacoServings.filter((s) => tacoIds.has(s.foodId));
  const mergedServings = [...FOOD_SERVINGS.filter((s) => !tacoIds.has(s.foodId)), ...tacoServings];
  replaceFoodCatalog(mergedItems, mergedServings);
}

export function allFoods(activeOnly = true): FoodItem[] {
  return activeOnly ? items.filter((f) => f.active) : [...items];
}

export function foodById(id: string): FoodItem | undefined {
  return byId.get(id);
}

export function foodByEan(ean: string): FoodItem | undefined {
  const parsed = eanDigits(ean);
  return parsed ? byEan.get(parsed) : undefined;
}

export function servingsForFood(foodId: string): FoodServing[] {
  return servingsByFood.get(foodId) ?? [];
}

export function defaultServing(foodId: string): FoodServing | undefined {
  const list = servingsForFood(foodId);
  return list.find((s) => s.isDefault) ?? list[0];
}

export function foodsByCategory(category: FoodItem["category"]): FoodItem[] {
  return allFoods().filter((f) => f.category === category);
}

export function catalogStats() {
  return {
    foods: items.length,
    servings: servings.length,
    active: items.filter((f) => f.active).length,
  };
}
