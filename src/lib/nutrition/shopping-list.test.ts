import { describe, expect, it } from "vitest";
import { MEAL_PRESETS } from "@/data/meal-presets";
import {
  PRESET_TO_RECIPE,
  recipeForPreset,
  shoppingListFromWeekPlan,
  shoppingListToText,
} from "@/lib/nutrition/shopping-list";
import type { DailyMealPlan } from "@/lib/nutrition/meal-planner";

describe("shopping list from week plan", () => {
  it("maps main presets to recipes", () => {
    expect(recipeForPreset({ id: "cafe-ovos" })).toBe("recipe-ovos-pao");
    expect(recipeForPreset({ id: "almoco-frango" })).toBe("recipe-frango-arroz-feijao");
    expect(Object.keys(PRESET_TO_RECIPE).length).toBeGreaterThanOrEqual(14);
  });

  it("aggregates recipe ingredients from suggested presets", () => {
    const frango = MEAL_PRESETS.find((p) => p.id === "almoco-frango")!;
    const week: DailyMealPlan[] = [
      {
        date: "2026-09-22",
        slots: [
          {
            slot: "almoco",
            status: "suggested",
            preset: frango,
            logged: [],
            suggestedServings: 1,
          },
        ],
        goals: { kcal: 2000, proteinG: 150, mealsTarget: 4, waterMl: 2500 },
        projectedProteinG: 48,
        projectedKcal: 520,
        redistributed: false,
      },
    ];
    const lines = shoppingListFromWeekPlan(week);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.some((l) => l.foodId === "frango-peito-grelhado")).toBe(true);
    expect(lines.some((l) => l.foodId === "arroz-branco-cozido")).toBe(true);
    const text = shoppingListToText(lines);
    expect(text.toLowerCase()).toContain("frango");
  });

  it("falls back to opaque line when preset has no recipe", () => {
    const week: DailyMealPlan[] = [
      {
        date: "2026-09-22",
        slots: [
          {
            slot: "lanche",
            status: "suggested",
            preset: { id: "unknown-preset", label: "Lanche misterioso", slot: "lanche", proteinG: 10, kcal: 200, quality: "amarelo" },
            logged: [],
          },
        ],
        goals: { kcal: 2000, proteinG: 150, mealsTarget: 4, waterMl: 2500 },
        projectedProteinG: 10,
        projectedKcal: 200,
        redistributed: false,
      },
    ];
    const lines = shoppingListFromWeekPlan(week);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.name).toBe("Lanche misterioso");
    expect(lines[0]!.unit).toBe("refeição");
  });
});
