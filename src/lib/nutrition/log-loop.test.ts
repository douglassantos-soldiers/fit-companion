import { describe, expect, it } from "vitest";
import { makeProposal } from "@/lib/coach/proposals";
import { acceptCoachProposal } from "@/lib/coach/apply-proposal";
import { buildDailyMealPlan } from "@/lib/engine/nutrition";
import { clampServings, copyMealToSlot, lastMealForSlot, proteinGapLine } from "@/lib/nutrition/log-loop";
import { emptyState, type MealEntry, type Profile } from "@/lib/types";

const meal = (over: Partial<MealEntry> & Pick<MealEntry, "id" | "date" | "slot">): MealEntry => ({
  label: "Almoço",
  proteinG: 40,
  kcal: 500,
  quality: "verde",
  ...over,
});

describe("nutrition log loop", () => {
  it("finds last meal for a slot before today", () => {
    const meals: MealEntry[] = [
      meal({ id: "1", date: "2026-09-18", slot: "almoco", label: "Frango" }),
      meal({ id: "2", date: "2026-09-17", slot: "almoco", label: "Carne" }),
      meal({ id: "3", date: "2026-09-18", slot: "jantar", label: "Peixe" }),
    ];
    expect(lastMealForSlot(meals, "almoco", "2026-09-19")?.label).toBe("Frango");
    expect(lastMealForSlot(meals, "cafe", "2026-09-19")).toBeNull();
  });

  it("copies meal to another slot", () => {
    const src = meal({ id: "1", date: "2026-09-18", slot: "almoco", presetId: "almoco-frango", servings: 1.25 });
    const copy = copyMealToSlot(src, "jantar");
    expect(copy.slot).toBe("jantar");
    expect(copy.label).toBe(src.label);
    expect(copy.presetId).toBe("almoco-frango");
    expect(copy.servings).toBe(1.25);
  });

  it("formats protein gap and clamps servings", () => {
    expect(proteinGapLine(100, 180, "almoco")).toBe("Faltam 80 g de proteína · Almoço agora");
    expect(proteinGapLine(180, 180)).toBe("Proteína no alvo · 180/180 g");
    expect(clampServings(0.1)).toBe(0.25);
    expect(clampServings(1.12)).toBe(1);
    expect(clampServings(4)).toBe(3);
  });
});

describe("coach accept nutrition", () => {
  it("applies water and next preset", () => {
    const water = acceptCoachProposal(makeProposal("HYDRATION_FOCUS", true, ["hydration"], {}, 0.7), {});
    expect(water).toEqual({ kind: "water", ml: 500 });

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
    const mealPlan = buildDailyMealPlan(profile, { ...emptyState, profile });
    const mealResult = acceptCoachProposal(makeProposal("NUTRITION_FOCUS", true, ["protein_low"], {}, 0.7), {
      mealPlan,
    });
    expect(mealResult.kind).toBe("meal");
    if (mealResult.kind === "meal") {
      expect(mealResult.entry.proteinG).toBeGreaterThan(0);
      expect(mealResult.label.length).toBeGreaterThan(0);
    }
  });
});
