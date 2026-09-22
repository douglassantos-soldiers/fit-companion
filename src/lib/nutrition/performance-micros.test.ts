import { describe, expect, it } from "vitest";
import { foodById, resetFoodCatalog } from "@/lib/nutrition/food-catalog";
import { dayPerformanceMicros, PERFORMANCE_MICRO_KEYS } from "@/lib/nutrition/nutrients";
import { mapMealEntryRow } from "@/lib/sync/meal-map";
import type { MealEntry } from "@/lib/types";

describe("dayPerformanceMicros", () => {
  it("returns null for empty meals", () => {
    expect(dayPerformanceMicros([])).toBeNull();
  });

  it("always returns exactly the 4 performance keys", () => {
    const meals: MealEntry[] = [
      {
        id: "m1",
        date: "2026-09-22",
        slot: "almoco",
        label: "Feijão",
        proteinG: 10,
        kcal: 120,
        quality: "verde",
        fiberG: 8,
        items: [
          {
            foodId: "feijao-carioca-cozido",
            quantity: 1,
            unit: "g",
            grams: 100,
            nutrientSnapshot: {
              energyKcal: 76,
              proteinG: 4.8,
              carbG: 13.6,
              fatG: 0.5,
              fiberG: 8.5,
              sodiumMg: 10,
              capturedAt: "2026-09-22T12:00:00.000Z",
              source: "internal",
              kind: "observed",
              confidence: 0.9,
              extras: {
                ironMg: {
                  key: "ironMg",
                  value: 1.5,
                  unit: "mg",
                  source: "internal",
                  kind: "observed",
                  confidence: 0.8,
                },
                calciumMg: {
                  key: "calciumMg",
                  value: 50,
                  unit: "mg",
                  source: "internal",
                  kind: "observed",
                  confidence: 0.8,
                },
              },
            },
            confidence: 0.9,
            sourceKind: "informed",
          },
        ],
      },
    ];
    const lines = dayPerformanceMicros(meals);
    expect(lines).toHaveLength(4);
    expect(lines!.map((l) => l.key)).toEqual([...PERFORMANCE_MICRO_KEYS]);
    expect(lines!.some((l) => l.key === "calciumMg")).toBe(false);
    expect(lines!.find((l) => l.key === "fiberG")?.value).toBe(8.5);
    expect(lines!.find((l) => l.key === "sodiumMg")?.value).toBe(10);
    expect(lines!.find((l) => l.key === "ironMg")?.value).toBe(1.5);
    expect(lines!.find((l) => l.key === "vitaminDUcg")?.value).toBe(0);
  });
});

describe("performance micros seed", () => {
  it("exposes iron on curated foods via extras", () => {
    resetFoodCatalog();
    const feijao = foodById("feijao-carioca-cozido");
    expect(feijao?.per100g.extras?.ironMg?.value).toBeGreaterThan(0);
    const salmao = foodById("salmao-grelhado");
    expect(salmao?.per100g.extras?.vitaminDUcg?.value).toBeGreaterThan(0);
  });
});

describe("meal-map extras round-trip", () => {
  it("preserves extras on hydrate", () => {
    const entry = mapMealEntryRow({
      client_id: "m1",
      date: "2026-09-22",
      protein_g: 10,
      kcal: 100,
      payload: {
        slot: "almoco",
        label: "Test",
        quality: "verde",
        items: [
          {
            foodId: "x",
            quantity: 1,
            unit: "g",
            grams: 100,
            confidence: 1,
            sourceKind: "informed",
            nutrientSnapshot: {
              energyKcal: 100,
              proteinG: 10,
              carbG: 0,
              fatG: 0,
              fiberG: 2,
              sodiumMg: 200,
              capturedAt: "2026-09-22T12:00:00.000Z",
              source: "imported",
              kind: "estimated",
              confidence: 0.6,
              extras: {
                ironMg: {
                  key: "ironMg",
                  value: 2.2,
                  unit: "mg",
                  source: "imported",
                  kind: "estimated",
                  confidence: 0.6,
                },
              },
            },
          },
        ],
      },
    });
    expect(entry.items?.[0]?.nutrientSnapshot.extras?.ironMg?.value).toBe(2.2);
    expect(entry.items?.[0]?.nutrientSnapshot.sodiumMg).toBe(200);
  });
});
