/**
 * Phase 2 Nutrition Intelligence — domain tests
 */
import { describe, expect, it } from "vitest";
import { foodById, defaultServing } from "@/lib/nutrition/food-catalog";
import { searchFoods } from "@/lib/nutrition/food-search";
import { resolveGrams, servingToGrams } from "@/lib/nutrition/food-serving";
import { buildMealItem, mealFromItems, mealItemsMacros } from "@/lib/nutrition/meal-builder";
import { recipeById, mealFromRecipe, recipeMacrosPerServing } from "@/lib/nutrition/recipes";
import { parseVoiceFoodText } from "@/lib/nutrition/voice-parse";
import { dayMealTotals } from "@/lib/nutrition/nutrition-context";
import { scaleMacros, sumMacros, macroDistribution } from "@/lib/nutrition/nutrients";
import { aggregateNutrition } from "@/lib/customer360/aggregators/nutrition";
import { parseMealAiSuggestion } from "@/lib/meal-ai-contract";
import { emptyState, type MealEntry, type Profile } from "@/lib/types";
import { todayKey } from "@/lib/types";

describe("food by gram / unit", () => {
  it("scales arroz per 150 g", () => {
    const food = foodById("arroz-branco-cozido")!;
    const m = scaleMacros(food.per100g, 1.5);
    expect(m.energyKcal).toBeCloseTo(192, 0);
    expect(m.proteinG).toBeCloseTo(3.8, 0);
    expect(m.carbG).toBeGreaterThan(40);
  });

  it("converts unidade serving for ovo", () => {
    const serving = defaultServing("ovo-cozido")!;
    expect(servingToGrams(serving, 2)).toBe(100);
    const resolved = resolveGrams("ovo-cozido", 2, "unidade");
    expect(resolved.grams).toBe(100);
  });
});

describe("nutrient sum / meal item", () => {
  it("sums meal items into snapshot", () => {
    const a = buildMealItem({
      foodId: "arroz-branco-cozido",
      quantity: 150,
      unit: "g",
      sourceKind: "informed",
    })!;
    const b = buildMealItem({
      foodId: "frango-peito-grelhado",
      quantity: 180,
      unit: "g",
      sourceKind: "informed",
    })!;
    const macros = mealItemsMacros([a, b]);
    expect(macros.proteinG).toBeGreaterThan(50);
    expect(macros.energyKcal).toBeGreaterThan(300);

    const meal = mealFromItems([a, b]);
    expect(meal.items).toHaveLength(2);
    expect(meal.nutrientSnapshot.kind).toBe("observed");
    expect(meal.sourceKind).toBe("informed");
  });

  it("marks AI estimate as estimated never observed", () => {
    const item = buildMealItem({
      foodId: "banana-prata",
      quantity: 1,
      unit: "unidade",
      sourceKind: "estimated",
      foodSource: "ai_estimate",
      kind: "estimated",
      confidence: 0.5,
    })!;
    expect(item.nutrientSnapshot.kind).toBe("estimated");
    expect(item.nutrientSnapshot.source).toBe("ai_estimate");
    expect(item.sourceKind).toBe("estimated");
  });
});

describe("recipe", () => {
  it("hydrates recipe macros and per serving", () => {
    const r = recipeById("recipe-frango-arroz-feijao")!;
    expect(r.items.length).toBeGreaterThan(2);
    expect(r.totalMacros.proteinG).toBeGreaterThan(40);
    const per = recipeMacrosPerServing(r);
    expect(per.energyKcal).toBe(r.totalMacros.energyKcal);
    const meal = mealFromRecipe("recipe-whey-banana");
    expect(meal.proteinG).toBeGreaterThan(20);
  });
});

describe("food search", () => {
  it("finds by synonym", () => {
    const hits = searchFoods("frango", { limit: 5 });
    expect(hits.some((h) => h.food.id.includes("frango"))).toBe(true);
  });
});

describe("voice parsing", () => {
  it("parses 150g arroz, 180g frango e uma banana", () => {
    const result = parseVoiceFoodText("150g de arroz, 180g de frango e uma banana");
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.candidates.every((c) => c.matched || c.foodName)).toBe(true);
    expect(result.needsConfirmation).toBeDefined();
    // does not invent brand
    expect(result.items.every((i) => !i.foodName?.includes("Nestlé"))).toBe(true);
  });
});

describe("AI estimate contract", () => {
  it("flags low confidence for confirmation", () => {
    const s = parseMealAiSuggestion({
      label: "Prato misto",
      proteinG: 30,
      kcal: 500,
      carbG: 40,
      fatG: 15,
      quality: "amarelo",
      confidence: 0.4,
      candidates: [{ name: "arroz", confidence: 0.4 }],
    });
    expect(s.needsConfirmation).toBe(true);
    expect(s.carbG).toBe(40);
  });
});

describe("logging incompleteness ≠ zero adherence", () => {
  it("lowers confidence without zeroing protein adherence from empty days", () => {
    const profile: Profile = {
      name: "T",
      goal: "massa",
      level: "intermediario",
      daysPerWeek: 4,
      age: 30,
      heightCm: 175,
      weightKg: 80,
      equipment: "academia",
      restrictions: [],
      createdAt: new Date().toISOString(),
    };
    const today = todayKey();
    const meals: MealEntry[] = [
      {
        id: "1",
        date: today,
        slot: "almoco",
        label: "Frango",
        proteinG: 80,
        kcal: 600,
        quality: "verde",
        sourceKind: "informed",
      },
    ];
    const n360 = aggregateNutrition({ ...emptyState, profile, meals });
    expect(n360.proteinAdherence7d).not.toBeNull();
    expect(n360.proteinAdherence7d!).toBeGreaterThan(0);
    expect(n360.loggingCompleteness7d!).toBeLessThan(0.5);
    expect(n360.proteinAdherence?.basis).toBe("partial_logging");
    expect(n360.kcalAdherence).toBeDefined();
    expect(n360.nutritionConfidence).toBeDefined();
  });
});

describe("day macros", () => {
  it("aggregates carb fat fiber", () => {
    const date = todayKey();
    const meals: MealEntry[] = [
      {
        id: "1",
        date,
        slot: "almoco",
        label: "Test",
        proteinG: 40,
        carbG: 50,
        fatG: 10,
        fiberG: 8,
        kcal: 450,
        quality: "verde",
      },
    ];
    const t = dayMealTotals(meals, date);
    expect(t.carbG).toBe(50);
    expect(t.fatG).toBe(10);
    expect(t.fiberG).toBe(8);
    const dist = macroDistribution(sumMacros([{ energyKcal: 450, proteinG: 40, carbG: 50, fatG: 10 }]));
    expect(dist.protein + dist.carb + dist.fat).toBeCloseTo(1, 1);
  });
});
