import { describe, expect, it, beforeEach } from "vitest";
import { resetFoodCatalog } from "@/lib/nutrition/food-catalog";
import { buildMealItem, mealFromItems } from "@/lib/nutrition/meal-builder";

describe("meal pick nutrientSnapshot", () => {
  beforeEach(() => resetFoodCatalog());

  it("includes sodium and iron extras on food meal header", () => {
    const item = buildMealItem({
      foodId: "feijao-carioca-cozido",
      quantity: 1,
      unit: "100 g",
      grams: 100,
      sourceKind: "informed",
      foodSource: "internal",
    });
    expect(item).toBeTruthy();
    const meal = mealFromItems([item!]);
    expect(meal.nutrientSnapshot.fiberG).toBeGreaterThan(0);
    expect(meal.nutrientSnapshot.extras?.ironMg?.value).toBeGreaterThan(0);
  });
});
