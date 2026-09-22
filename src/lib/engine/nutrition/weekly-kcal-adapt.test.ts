import { describe, expect, it } from "vitest";
import {
  computeWeeklyKcalAdaptation,
  isoWeekKey,
} from "@/lib/engine/nutrition/weekly-kcal-adapt";
import { computeNutritionGoals } from "@/lib/nutrition/meal-planner";
import type { Profile } from "@/lib/types";

const baseProfile = (over: Partial<Profile> = {}): Profile =>
  ({
    name: "Test",
    goal: "gordura",
    level: "intermediario",
    weightKg: 80,
    heightCm: 175,
    age: 30,
    daysPerWeek: 4,
    equipment: "academia",
    restrictions: [],
    createdAt: "2026-01-01",
    ...over,
  }) as Profile;

describe("weekly kcal adaptation", () => {
  it("blocks on incomplete logging", () => {
    const r = computeWeeklyKcalAdaptation({
      goal: "gordura",
      date: "2026-09-22",
      weightTrendKg7d: 0.8,
      loggingCompleteness7d: 0.2,
      kcalAdherence: 0.9,
    });
    expect(r.delta).toBe(0);
    expect(r.reasonCodes).toContain("incomplete_logging");
  });

  it("blocks on adherence gate", () => {
    const r = computeWeeklyKcalAdaptation({
      goal: "massa",
      date: "2026-09-22",
      weightTrendKg7d: -0.6,
      loggingCompleteness7d: 0.8,
      kcalAdherence: 0.5,
    });
    expect(r.delta).toBe(0);
    expect(r.reasonCodes).toContain("adherence_gate");
  });

  it("cuts kcal when weight rises on cut with good adherence", () => {
    const r = computeWeeklyKcalAdaptation({
      goal: "gordura",
      date: "2026-09-22",
      weightTrendKg7d: 0.8,
      loggingCompleteness7d: 0.85,
      kcalAdherence: 0.9,
    });
    expect(r.delta).toBe(-200);
    expect(r.reasonCodes).toContain("weight_trend_up");
    expect(r.weekKey).toBe(isoWeekKey("2026-09-22"));
  });

  it("raises kcal when weight drops on mass with good adherence", () => {
    const r = computeWeeklyKcalAdaptation({
      goal: "massa",
      date: "2026-09-22",
      weightTrendKg7d: -0.8,
      loggingCompleteness7d: 0.9,
      kcalAdherence: 0.95,
    });
    expect(r.delta).toBe(200);
    expect(r.reasonCodes).toContain("weight_trend_down");
  });

  it("does not double-apply insights kcalDelta in nutrition goals", () => {
    const profile = baseProfile({ goal: "gordura", weightKg: 80 });
    const base = computeNutritionGoals(profile);
    const withInsight = computeNutritionGoals(profile, {
      proteinAdherence7d: 0.9,
      weightTrendKg7d: 1,
      supplementAdherence30d: 0.8,
      hardRpeStreak: 0,
      reasons: [],
      adaptations: { kcalDelta: -150, proteinBias: "hold", weekHint: null, preferGreenMeals: false },
    });
    expect(withInsight.kcal).toBe(base.kcal);
    const withEngine = computeNutritionGoals(profile, null, { calorieDelta: -100 });
    expect(withEngine.kcal).toBe(base.kcal - 100);
  });
});
