/**
 * Fase 13 — barcode, TACO license gate, 7-day plan, saved meals, micros.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  barcodeHitFromOffProduct,
  lookupLocalBarcode,
  mapOffNutriments,
  mealItemFromBarcode,
  parseEan,
  resolveBarcodeHit,
} from "@/lib/nutrition/barcode";
import { extrasFromNutrientRows, foodItemFromCatalogRow } from "@/lib/nutrition/catalog-hydrate";
import { applyTacoCatalog, foodByEan, foodById, replaceFoodCatalog, resetFoodCatalog } from "@/lib/nutrition/food-catalog";
import { FOOD_ITEMS, FOOD_SERVINGS } from "@/data/foods";
import {
  nutritionLibrary,
  removeSavedMealFromList,
  savedMealFromEntry,
  upsertSavedMeal,
} from "@/lib/nutrition/library";
import { buildDailyMealPlanCore, buildMultiDayMealPlan, shiftDateKey } from "@/lib/nutrition/meal-planner";
import { dayMicrosFromMeals } from "@/lib/nutrition/nutrients";
import { emptyState, type MealEntry, type Profile, type SavedMeal } from "@/lib/types";
import type { FoodItem, FoodServing } from "@/lib/nutrition/types";

const profile: Profile = {
  name: "Test",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 4,
  age: 30,
  heightCm: 178,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
};

afterEach(() => {
  resetFoodCatalog();
});

describe("barcode", () => {
  it("parses EAN-8/13 and rejects invalid", () => {
    expect(parseEan("7891234567895")).toBe("7891234567895");
    expect(parseEan("7891 2345")).toBe("78912345");
    expect(parseEan("123")).toBeNull();
    expect(parseEan("abc")).toBeNull();
  });

  it("marks incomplete OFF nutriments as estimated", () => {
    const incomplete = mapOffNutriments({ proteins_100g: 8 });
    expect(incomplete.complete).toBe(false);
    const hit = barcodeHitFromOffProduct("7891000100103", {
      product_name: "Iogurte X",
      nutriments: { proteins_100g: 8 },
    });
    expect(hit?.kind).toBe("estimated");
    expect(mealItemFromBarcode(hit!).sourceKind).toBe("estimated");
    expect(mealItemFromBarcode(hit!).foodSource).toBe("imported");
  });

  it("prefers internal catalog EAN over Open Food Facts", () => {
    const local: FoodItem = {
      id: "local-ean-whey",
      name: "Whey interno",
      category: "suplementos",
      source: "internal",
      servingReference: "s-100g",
      active: true,
      confidence: 1,
      ean: "7891000100103",
      per100g: { energyKcal: 380, proteinG: 80, carbG: 6, fatG: 4 },
    };
    const serving: FoodServing = {
      id: "local-ean-whey:s-100g",
      foodId: local.id,
      label: "100 g",
      gramsEquivalent: 100,
      isDefault: true,
    };
    replaceFoodCatalog([...FOOD_ITEMS, local], [...FOOD_SERVINGS, serving]);
    expect(foodByEan("7891000100103")?.id).toBe(local.id);
    expect(lookupLocalBarcode("7891000100103")?.name).toBe("Whey interno");
    const resolved = resolveBarcodeHit("7891000100103", {
      product_name: "Produto OFF",
      brands: "Marca",
      nutriments: { "energy-kcal_100g": 200, proteins_100g: 10, carbohydrates_100g: 20, fat_100g: 5 },
    });
    expect(resolved?.name).toBe("Whey interno");
    expect(resolved?.foodId).toBe(local.id);
  });
});

describe("taco-gate", () => {
  const taco: FoodItem = {
    id: "taco-feijao-test",
    name: "Feijão TACO",
    category: "leguminosas",
    source: "taco",
    servingReference: "s-100g",
    active: true,
    confidence: 0.9,
    per100g: { energyKcal: 76, proteinG: 4.8, carbG: 13.6, fatG: 0.5 },
  };
  const tacoServing: FoodServing = {
    id: "taco-feijao-test:s-100g",
    foodId: taco.id,
    label: "100 g",
    gramsEquivalent: 100,
    isDefault: true,
  };

  it("ignores taco foods without license flag", () => {
    applyTacoCatalog({ tacoLicenseVerified: false, tacoFoods: [taco], tacoServings: [tacoServing] });
    expect(foodById("taco-feijao-test")).toBeUndefined();
    expect(foodById("arroz-branco-cozido")).toBeDefined();
  });

  it("merges taco foods when license is verified", () => {
    applyTacoCatalog({ tacoLicenseVerified: true, tacoFoods: [taco], tacoServings: [tacoServing] });
    expect(foodById("taco-feijao-test")?.name).toBe("Feijão TACO");
    expect(foodById("arroz-branco-cozido")).toBeDefined();
  });

  it("does not treat catalog rows as taco unless source=taco", () => {
    const row = foodItemFromCatalogRow({
      id: "imp-1",
      name: "Importado",
      category: "outros",
      source: "imported",
      serving_reference: "s-100g",
      confidence: 0.5,
      per100g: { energyKcal: 10, proteinG: 1, carbG: 1, fatG: 0 },
    });
    expect(row?.source).toBe("imported");
    const extras = extrasFromNutrientRows(
      [{ nutrient_key: "ironMg", value: 1.2, unit: "mg", source: "taco", kind: "observed", confidence: 0.9 }],
      "taco",
    );
    expect(extras?.["ironMg"]?.value).toBe(1.2);
  });
});

describe("multi-day", () => {
  it("builds 7 daily plans from start date", () => {
    const start = "2026-09-19";
    const week = buildMultiDayMealPlan(profile, { ...emptyState, profile }, start, 7);
    expect(week).toHaveLength(7);
    expect(week[0]?.date).toBe(start);
    expect(week[6]?.date).toBe(shiftDateKey(start, 6));
    expect(week.every((d) => d.slots.length === 4)).toBe(true);
  });

  it("redistributes a skipped slot the same as the daily planner", () => {
    const date = "2026-09-19";
    const state = {
      ...emptyState,
      profile,
      dayCheckIns: {
        [date]: {
          date,
          sleepHours: 7,
          energy: "ok" as const,
          availableMin: 60,
          skippedSlots: ["cafe" as const],
        },
      },
    };
    const daily = buildDailyMealPlanCore(profile, state, date, null, { skippedSlots: ["cafe"] });
    const week = buildMultiDayMealPlan(profile, state, date, 7);
    expect(week[0]?.redistributed).toBe(true);
    expect(week[0]?.redistributed).toBe(daily.redistributed);
    expect(week[0]?.slots.find((s) => s.slot === "cafe")?.status).toBe("skipped");
    expect(week[0]?.slots.find((s) => s.slot === "cafe")?.status).toBe(
      daily.slots.find((s) => s.slot === "cafe")?.status,
    );
    expect(week[1]?.slots.find((s) => s.slot === "cafe")?.status).not.toBe("skipped");
  });
});

describe("saved-meals", () => {
  const entry: MealEntry = {
    id: "m1",
    date: "2026-09-19",
    slot: "almoco",
    label: "Frango montado",
    proteinG: 45,
    kcal: 520,
    quality: "verde",
    items: [
      {
        foodId: "frango-peito-grelhado",
        quantity: 1,
        unit: "100 g",
        grams: 150,
        nutrientSnapshot: {
          energyKcal: 240,
          proteinG: 48,
          carbG: 0,
          fatG: 4,
          capturedAt: "2026-09-19T12:00:00.000Z",
          source: "internal",
          kind: "observed",
          confidence: 1,
        },
        confidence: 1,
        sourceKind: "informed",
      },
    ],
  };

  it("saves and removes templates; library lists favorite + recent + saved", () => {
    const template = { ...savedMealFromEntry(entry), id: "s1", createdAt: "2026-09-19T12:00:00.000Z" } satisfies SavedMeal;
    const saved = upsertSavedMeal([], template);
    expect(saved).toHaveLength(1);
    expect(removeSavedMealFromList(saved, "s1")).toHaveLength(0);

    const lib = nutritionLibrary(
      [entry],
      ["almoco-frango"],
      [template],
    );
    expect(lib.saved[0]?.id).toBe("s1");
    expect(lib.recentCustom[0]?.label).toBe("Frango montado");
    expect(lib.favorites.some((p) => p.id === "almoco-frango")).toBe(true);
  });
});

describe("micros", () => {
  it("returns null when meals have no extras", () => {
    const meals: MealEntry[] = [
      {
        id: "m0",
        date: "2026-09-19",
        slot: "cafe",
        label: "Ovos",
        proteinG: 12,
        kcal: 150,
        quality: "amarelo",
        items: [
          {
            foodId: "ovo-cozido",
            quantity: 1,
            unit: "unidade",
            grams: 50,
            nutrientSnapshot: {
              energyKcal: 73,
              proteinG: 6.6,
              carbG: 0.3,
              fatG: 4.7,
              capturedAt: "2026-09-19T12:00:00.000Z",
              source: "internal",
              kind: "observed",
              confidence: 1,
            },
            confidence: 1,
            sourceKind: "informed",
          },
        ],
      },
    ];
    expect(dayMicrosFromMeals(meals)).toBeNull();
  });

  it("shows ferro when extras are present", () => {
    const meals: MealEntry[] = [
      {
        id: "m1",
        date: "2026-09-19",
        slot: "almoco",
        label: "Feijão",
        proteinG: 10,
        kcal: 120,
        quality: "verde",
        items: [
          {
            foodId: "taco-feijao-test",
            quantity: 1,
            unit: "100 g",
            grams: 140,
            nutrientSnapshot: {
              energyKcal: 106,
              proteinG: 6.7,
              carbG: 19,
              fatG: 0.7,
              capturedAt: "2026-09-19T12:00:00.000Z",
              source: "taco",
              kind: "observed",
              confidence: 0.9,
              extras: {
                ironMg: {
                  key: "ironMg",
                  value: 1.8,
                  unit: "mg",
                  source: "taco",
                  kind: "observed",
                  confidence: 0.9,
                },
              },
            },
            confidence: 0.9,
            sourceKind: "informed",
            foodSource: "taco",
          },
        ],
      },
    ];
    const micros = dayMicrosFromMeals(meals);
    expect(micros).not.toBeNull();
    expect(micros?.some((m) => m.key === "ironMg" && m.value > 0 && m.label === "Ferro")).toBe(true);
  });
});
