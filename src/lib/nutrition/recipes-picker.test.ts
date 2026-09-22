import { describe, expect, it } from "vitest";
import { mealFromRecipe, recipeById } from "@/lib/nutrition/recipes";

describe("mealFromRecipe picker path", () => {
  it("builds a custom-pick-compatible meal from a recipe", () => {
    const recipe = recipeById("recipe-frango-arroz-feijao");
    expect(recipe).toBeTruthy();
    const meal = mealFromRecipe("recipe-frango-arroz-feijao", 1);
    expect(meal.label).toBe(recipe!.name);
    expect(meal.items.length).toBeGreaterThanOrEqual(3);
    expect(meal.kcal).toBeGreaterThan(0);
    expect(meal.proteinG).toBeGreaterThan(0);
    expect(meal.sourceKind).toBe("informed");
    const double = mealFromRecipe("recipe-frango-arroz-feijao", 2);
    expect(double.kcal).toBeGreaterThan(meal.kcal);
  });
});
