import { describe, expect, it } from "vitest";
import { FOOD_ITEMS } from "@/data/foods";
import { RECIPE_SEEDS } from "@/data/recipes";
import { INTERNAL_SOURCE_VERSION } from "@/data/foods-helpers";
import {
  foodById,
  foodSearchIndexSize,
  lookupFoodCandidateIds,
} from "@/lib/nutrition/food-catalog";
import { searchFoods } from "@/lib/nutrition/food-search";
import { allRecipes } from "@/lib/nutrition/recipes";

const REQUIRED_TAGS = [
  "cafe",
  "almoco",
  "jantar",
  "lanche",
  "pre-treino",
  "pos-treino",
  "rapidas",
  "alta-proteina",
  "baixo-custo",
  "sem-lactose",
  "sem-carne",
  "delivery",
  "refeicao-fora",
] as const;

describe("catalog scale foods", () => {
  it("expands the internal seed without TACO rows", () => {
    expect(FOOD_ITEMS.length).toBeGreaterThanOrEqual(190);
    expect(FOOD_ITEMS.every((f) => f.source === "internal")).toBe(true);
    expect(FOOD_ITEMS.every((f) => typeof f.confidence === "number" && f.confidence > 0)).toBe(
      true,
    );
    expect(FOOD_ITEMS.some((f) => f.source === "taco")).toBe(false);
  });

  it("stamps sourceVersion on lote 2 foods", () => {
    const versioned = FOOD_ITEMS.filter((f) => f.sourceVersion === INTERNAL_SOURCE_VERSION);
    expect(versioned.length).toBeGreaterThanOrEqual(90);
    expect(FOOD_ITEMS.every((f) => !f.ean)).toBe(true);
  });

  it("finds foods by synonym and brand via the inverted index", () => {
    expect(foodSearchIndexSize()).toBeGreaterThan(0);
    const bySynonym = searchFoods("chicken", { limit: 8 });
    expect(bySynonym.some((h) => h.food.id.includes("frango"))).toBe(true);
    const byBrand = searchFoods("marca própria", { brand: "marca própria", limit: 8 });
    expect(byBrand.length).toBeGreaterThan(0);
    expect(byBrand.every((h) => h.food.brand === "marca própria")).toBe(true);
    const candidates = lookupFoodCandidateIds("peito de frango");
    expect(candidates?.has("frango-peito-grelhado")).toBe(true);
  });
});

describe("catalog scale recipes", () => {
  it("resolves every recipe foodId and keeps derived macros non-negative", () => {
    expect(RECIPE_SEEDS.length).toBeGreaterThanOrEqual(40);
    const recipes = allRecipes();
    expect(recipes).toHaveLength(RECIPE_SEEDS.length);
    for (const recipe of recipes) {
      for (const item of recipe.items) {
        expect(foodById(item.foodId)?.id).toBe(item.foodId);
      }
      expect(recipe.totalMacros.energyKcal).toBeGreaterThanOrEqual(0);
      expect(recipe.totalMacros.proteinG).toBeGreaterThanOrEqual(0);
      expect(recipe.totalMacros.carbG).toBeGreaterThanOrEqual(0);
      expect(recipe.totalMacros.fatG).toBeGreaterThanOrEqual(0);
      expect(recipe.source).toBe("internal");
    }
  });

  it("covers the recipe tag categories", () => {
    const tags = new Set(RECIPE_SEEDS.flatMap((r) => r.tags ?? []));
    for (const tag of REQUIRED_TAGS) {
      expect(tags.has(tag)).toBe(true);
    }
  });
});
