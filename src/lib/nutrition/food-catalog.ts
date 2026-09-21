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

export function normalizeFoodToken(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function tokenizeFoodQuery(value: string): string[] {
  return normalizeFoodToken(value)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

let items: FoodItem[] = [...FOOD_ITEMS];
let servings: FoodServing[] = [...FOOD_SERVINGS];
let byId = new Map<string, FoodItem>();
let byEan = new Map<string, FoodItem>();
let servingsByFood = new Map<string, FoodServing[]>();
/** token → food ids (name, brand, synonyms, category, ean) */
let tokenIndex = new Map<string, Set<string>>();

function indexField(id: string, raw: string | undefined): void {
  if (!raw) return;
  for (const token of tokenizeFoodQuery(raw)) {
    const set = tokenIndex.get(token) ?? new Set<string>();
    set.add(id);
    tokenIndex.set(token, set);
  }
}

function rebuild() {
  byId = new Map(items.map((f) => [f.id, f]));
  byEan = new Map();
  tokenIndex = new Map();
  for (const f of items) {
    if (f.ean) {
      const ean = eanDigits(f.ean);
      if (ean) byEan.set(ean, f);
    }
    indexField(f.id, f.name);
    indexField(f.id, f.brand);
    indexField(f.id, f.category);
    indexField(f.id, f.ean);
    for (const syn of f.synonyms ?? []) indexField(f.id, syn);
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
    indexTokens: tokenIndex.size,
  };
}

export function foodSearchIndexSize(): number {
  return tokenIndex.size;
}

/**
 * Candidate ids from the inverted index. Null → caller should scan linearly
 * (empty query, empty index, or no token hits).
 */
export function lookupFoodCandidateIds(query: string): Set<string> | null {
  if (!tokenIndex.size) return null;
  const tokens = tokenizeFoodQuery(query);
  if (!tokens.length) return null;

  const digits = eanDigits(query.trim());
  const hits = new Set<string>();
  if (digits) {
    const exact = byEan.get(digits);
    if (exact) hits.add(exact.id);
  }

  for (const token of tokens) {
    const exact = tokenIndex.get(token);
    if (exact) {
      for (const id of exact) hits.add(id);
    }
    for (const [key, ids] of tokenIndex) {
      if (key !== token && (key.startsWith(token) || token.startsWith(key))) {
        for (const id of ids) hits.add(id);
      }
    }
  }

  return hits.size ? hits : null;
}
