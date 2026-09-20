/**
 * Serving conversions: serving → grams
 */
import { defaultServing, servingsForFood } from "@/lib/nutrition/food-catalog";
import type { FoodServing } from "@/lib/nutrition/types";

export function servingToGrams(serving: FoodServing, quantity = 1): number {
  return Math.max(0, serving.gramsEquivalent * quantity);
}

/** Resolve grams from unit label or serving id. */
export function resolveGrams(
  foodId: string,
  quantity: number,
  unit: string,
): { grams: number; serving?: FoodServing } {
  const q = Math.max(0, quantity);
  const normalized = unit.trim().toLowerCase();

  if (normalized === "g" || normalized === "grama" || normalized === "gramas") {
    return { grams: q };
  }
  if (normalized === "kg") {
    return { grams: q * 1000 };
  }
  if (normalized === "ml") {
    return { grams: q }; // approx 1:1 for water-like
  }

  const servings = servingsForFood(foodId);
  const byId = servings.find((s) => s.id === unit || s.id.endsWith(`:${unit}`));
  if (byId) return { grams: servingToGrams(byId, q), serving: byId };

  const byLabel = servings.find((s) => s.label.toLowerCase() === normalized);
  if (byLabel) return { grams: servingToGrams(byLabel, q), serving: byLabel };

  // Fuzzy unit keywords
  const keywords: Array<[RegExp, (s: FoodServing) => boolean]> = [
    [/colher/, (s) => /colher/i.test(s.label)],
    [/x[ií]cara/, (s) => /x[ií]cara/i.test(s.label)],
    [/fatia/, (s) => /fatia/i.test(s.label)],
    [/unidade|un\b/, (s) => /unidade|un\b/i.test(s.label)],
    [/scoop/, (s) => /scoop/i.test(s.label)],
    [/pote/, (s) => /pote/i.test(s.label)],
    [/copo/, (s) => /copo/i.test(s.label)],
    [/prato/, (s) => /prato/i.test(s.label)],
    [/fil[eé]/, (s) => /fil/i.test(s.label)],
  ];
  for (const [re, pred] of keywords) {
    if (re.test(normalized)) {
      const hit = servings.find(pred);
      if (hit) return { grams: servingToGrams(hit, q), serving: hit };
    }
  }

  const def = defaultServing(foodId);
  if (def) return { grams: servingToGrams(def, q), serving: def };
  return { grams: q };
}

export type { FoodServing };
