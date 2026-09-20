/**
 * Food search — name, category, brand, synonyms
 */
import { allFoods, defaultServing } from "@/lib/nutrition/food-catalog";
import { scaleMacros } from "@/lib/nutrition/nutrients";
import type { FoodCategory, FoodSearchHit } from "@/lib/nutrition/types";

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function scoreFood(query: string, haystacks: string[]): number {
  const q = normalize(query);
  if (!q) return 0;
  let best = 0;
  for (const raw of haystacks) {
    const h = normalize(raw);
    if (!h) continue;
    if (h === q) best = Math.max(best, 100);
    else if (h.startsWith(q)) best = Math.max(best, 90);
    else if (h.includes(q)) best = Math.max(best, 70);
    else {
      const tokens = q.split(/\s+/).filter(Boolean);
      const matched = tokens.filter((t) => h.includes(t)).length;
      if (matched) best = Math.max(best, 40 + (matched / tokens.length) * 30);
    }
  }
  return best;
}

export function searchFoods(
  query: string,
  opts?: { category?: FoodCategory; brand?: string; limit?: number },
): FoodSearchHit[] {
  const limit = opts?.limit ?? 20;
  const brandFilter = opts?.brand ? normalize(opts.brand) : null;
  const results: FoodSearchHit[] = [];

  for (const food of allFoods()) {
    if (opts?.category && food.category !== opts.category) continue;
    if (brandFilter && normalize(food.brand ?? "") !== brandFilter) continue;

    const haystacks = [food.name, food.brand ?? "", food.category, ...(food.synonyms ?? [])];
    const score = query.trim() ? scoreFood(query, haystacks) : 50;
    if (query.trim() && score < 40) continue;

    const serving = defaultServing(food.id);
    if (!serving) continue;
    const summary = scaleMacros(food.per100g, serving.gramsEquivalent / 100);
    results.push({ food, serving, summary, score });
  }

  results.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, "pt-BR"));
  return results.slice(0, limit);
}
