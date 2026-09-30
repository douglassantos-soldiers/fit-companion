import { describe, expect, it } from "vitest";
import {
  nutritionWhyLines,
  postLogProteinFeedback,
  weekNutritionSummary,
} from "@/lib/nutrition/week-summary";
import { emptyState, type AppState, type MealEntry } from "@/lib/types";

function meal(date: string, proteinG: number): MealEntry {
  return {
    id: `m-${date}-${proteinG}`,
    date,
    slot: "almoco",
    label: "Test",
    proteinG,
    kcal: proteinG * 10,
    quality: "verde",
  };
}

describe("weekNutritionSummary", () => {
  it("counts logged and protein hit days", () => {
    const state: AppState = {
      ...emptyState,
      profile: {
        name: "T",
        goal: "massa",
        level: "intermediario",
        weightKg: 80,
        heightCm: 180,
        age: 30,
        sex: "masculino",
        daysPerWeek: 4,
        equipment: "academia",
        restrictions: [],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      meals: [
        meal("2026-09-29", 160),
        meal("2026-09-28", 160),
        meal("2026-09-27", 40),
      ],
    };

    const summary = weekNutritionSummary(state, {
      now: new Date("2026-09-29T15:00:00"),
      kcalTrend: -100,
      reasonSeeds: ["incomplete_logging"],
    });
    expect(summary).not.toBeNull();
    expect(summary!.daysLogged).toBe(3);
    expect(summary!.proteinHitDays).toBeGreaterThanOrEqual(2);
    expect(summary!.gateCopy).toMatch(/Registro incompleto/i);
    expect(summary!.kcalCopy).toMatch(/-100/);
  });
});

describe("nutritionWhyLines", () => {
  it("prefers calories/protein keys", () => {
    const lines = nutritionWhyLines([
      { key: "training", label: "Treino", reason: "x" },
      { key: "protein", label: "Proteína", reason: "bias up" },
      { key: "calories", label: "Kcal", reason: "delta" },
    ]);
    expect(lines.map((l) => l.key)).toEqual(["protein", "calories"]);
  });
});

describe("postLogProteinFeedback", () => {
  it("shows remaining gap", () => {
    expect(postLogProteinFeedback(28, 100, 160)).toBe("+28 g · faltam 60 g");
    expect(postLogProteinFeedback(30, 160, 160)).toBe("+30 g · meta batida");
  });
});
