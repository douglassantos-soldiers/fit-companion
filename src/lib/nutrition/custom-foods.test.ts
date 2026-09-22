import { describe, expect, it, beforeEach } from "vitest";
import {
  applyUserCatalog,
  foodByEan,
  foodById,
  resetFoodCatalog,
} from "@/lib/nutrition/food-catalog";
import { searchFoods } from "@/lib/nutrition/food-search";
import {
  buildCustomFood,
  validateCustomFoodEan,
} from "@/lib/nutrition/custom-foods";

describe("custom foods", () => {
  beforeEach(() => {
    resetFoodCatalog();
  });

  it("rejects invalid EAN and accepts valid", () => {
    expect(validateCustomFoodEan("123")).toBeUndefined();
    expect(validateCustomFoodEan("7891000100103")).toBe("7891000100103");
  });

  it("merges into catalog for search and EAN lookup", () => {
    const food = buildCustomFood({
      name: "Whey caseiro test",
      category: "suplementos",
      kcal: 380,
      proteinG: 80,
      carbG: 5,
      fatG: 3,
      servingLabel: "1 scoop",
      servingGrams: 30,
      ean: "7891000100103",
      fiberG: 1,
      ironMg: 0.5,
    });
    applyUserCatalog([food]);
    expect(foodById(food.id)?.source).toBe("user");
    expect(foodByEan("7891000100103")?.id).toBe(food.id);
    const hits = searchFoods("whey caseiro", { limit: 10 });
    expect(hits.some((h) => h.food.id === food.id)).toBe(true);
    expect(foodById(food.id)?.per100g.extras?.ironMg?.value).toBe(0.5);
  });

  it("removes previous user foods on re-apply", () => {
    const a = buildCustomFood({
      name: "A",
      category: "outros",
      kcal: 100,
      proteinG: 1,
      carbG: 1,
      fatG: 1,
      servingLabel: "1",
      servingGrams: 50,
    });
    applyUserCatalog([a]);
    expect(foodById(a.id)).toBeTruthy();
    applyUserCatalog([]);
    expect(foodById(a.id)).toBeUndefined();
  });
});
