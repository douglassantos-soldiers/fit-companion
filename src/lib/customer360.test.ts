/**
 * Customer 360 aggregator tests.
 */
import { describe, expect, it } from "vitest";
import { buildCustomer360, buildCustomer360FromState } from "@/lib/customer360";
import { emptyState, type Profile } from "@/lib/types";

const profile: Profile = {
  name: "Teste",
  goal: "massa",
  level: "iniciante",
  daysPerWeek: 3,
  age: 30,
  heightCm: 175,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
};

describe("Customer 360 goals", () => {
  it("does not set goal from purchased products", () => {
    const c360 = buildCustomer360({
      ...emptyState,
      profile,
      purchaseProductIds: ["termogenico", "pre-treino"],
    });
    expect(c360.goals.currentGoal).toBe("massa");
    expect(c360.goals.source).toBe("profile");
    expect(c360.commerce.productIds).toContain("termogenico");
  });

  it("goals source is none without profile", () => {
    const c360 = buildCustomer360FromState({
      ...emptyState,
      purchaseProductIds: ["whey-protein"],
    });
    expect(c360.goals.currentGoal).toBeNull();
    expect(c360.goals.source).toBe("none");
  });
});

describe("Customer 360 filled metrics", () => {
  it("exports buildCustomer360 alias", () => {
    expect(buildCustomer360).toBe(buildCustomer360FromState);
  });

  it("fills proteinAdherence, adherence, streak, recovery when data exists", () => {
    const today = new Date();
    const dateKey = today.toISOString().slice(0, 10);
    const state = {
      ...emptyState,
      profile,
      sessions: [
        {
          id: "s1",
          dayId: "d1",
          title: "A",
          date: dateKey,
          durationMin: 40,
          exercises: [],
          volumeKg: 200,
        },
      ],
      meals: [
        {
          id: "m1",
          date: dateKey,
          slot: "almoco" as const,
          label: "Frango",
          proteinG: 40,
          kcal: 500,
          quality: "green" as const,
        },
      ],
      supplementRoutine: ["whey-protein"],
      supplementLogs: { [dateKey]: ["whey-protein"] },
      dayCheckIns: {
        [dateKey]: { date: dateKey, sleepHours: 7, energy: "ok" as const, availableMin: 60 },
      },
    };

    const c360 = buildCustomer360(state);
    expect(c360.nutrition.proteinAdherence7d).not.toBeNull();
    expect(c360.nutrition.proteinAdherence7d!).toBeGreaterThan(0);
    expect(c360.supplements.adherence30d).not.toBeNull();
    expect(c360.behavior.streak).toBeGreaterThanOrEqual(1);
    expect(c360.recovery.recoveryScore).not.toBeNull();
    expect(c360.recovery.recoveryScore!).toBeGreaterThan(0);
  });
});
