/**
 * Food search — name, category, brand, synonyms, EAN.
 * Uses inverted index candidates, then the stable FoodSearchHit score.
 */
import { allFoods, defaultServing, lookupFoodCandidateIds } from "@/lib/nutrition/food-catalog";
import { scaleMacros } from "@/lib/nutrition/nutrients";
import type { FoodCategory, FoodSearchHit } from "@/lib/nutrition/types";

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
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
  opts?: { category?: FoodCategory; brand?: string; ean?: string; limit?: number },
): FoodSearchHit[] {
  const limit = opts?.limit ?? 20;
  const brandFilter = opts?.brand ? normalize(opts.brand) : null;
  const eanFilter = opts?.ean ? opts.ean.replace(/\D/g, "") : "";
  const results: FoodSearchHit[] = [];
  const trimmed = query.trim();
  const candidateIds = trimmed ? lookupFoodCandidateIds(trimmed) : null;
  const pool = candidateIds ? allFoods().filter((f) => candidateIds.has(f.id)) : allFoods();

  for (const food of pool) {
    if (opts?.category && food.category !== opts.category) continue;
    if (brandFilter && normalize(food.brand ?? "") !== brandFilter) continue;
    if (eanFilter) {
      const foodEan = (food.ean ?? "").replace(/\D/g, "");
      if (foodEan !== eanFilter) continue;
    }

    const haystacks = [
      food.name,
      food.brand ?? "",
      food.category,
      food.ean ?? "",
      ...(food.synonyms ?? []),
    ];
    const score = trimmed ? scoreFood(query, haystacks) : 50;
    if (trimmed && score < 40) continue;

    const serving = defaultServing(food.id);
    if (!serving) continue;
    const summary = scaleMacros(food.per100g, serving.gramsEquivalent / 100);
    results.push({ food, serving, summary, score });
  }

  results.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, "pt-BR"));
  return results.slice(0, limit);
}
