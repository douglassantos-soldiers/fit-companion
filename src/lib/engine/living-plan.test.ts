/**
 * Living Plan: persona A vs B + adaptação pós check-in de sono.
 * Run: npm test
 */
import { describe, expect, it } from "vitest";
import { buildLivingPlan } from "@/lib/engine/living-plan";
import { emptyState, todayKey, type AppState, type Profile } from "@/lib/types";

const baseProfile: Profile = {
  name: "Teste",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 4,
  age: 28,
  heightCm: 178,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
};

function stateWith(profile: Profile, extras: Partial<AppState> = {}): AppState {
  return {
    ...emptyState,
    profile,
    dayCheckIns: {},
    livingPlans: {},
    ...extras,
  };
}

describe("buildLivingPlan — persona A vs B (mesmo goal)", () => {
  it("gera ações diferentes para bom sono vs sono ruim + baixa proteína", () => {
    const date = todayKey();

    const personaA = stateWith({
      ...baseProfile,
      typicalSleepHours: 8,
      primaryBlocker: "consistencia",
    });

    const personaB = stateWith(
      {
        ...baseProfile,
        typicalSleepHours: 5,
        primaryBlocker: "sono",
        skipBreakfast: true,
      },
      {
        dayCheckIns: {
          [date]: {
            date,
            sleepHours: 5,
            energy: "baixa",
            availableMin: 60,
          },
        },
        // Baixa proteína no dia → reforça eixo nutrição fraco
        meals: [
          {
            id: "m1",
            date,
            slot: "almoco",
            label: "Almoço leve",
            proteinG: 15,
            kcal: 400,
            quality: "laranja",
          },
        ],
      },
    );

    const planA = buildLivingPlan(personaA, date);
    const planB = buildLivingPlan(personaB, date);

    expect(planA).not.toBeNull();
    expect(planB).not.toBeNull();
    expect(planA!.workout.volumeFactor).toBeGreaterThan(planB!.workout.volumeFactor);
    expect(planB!.workout.mode).toBe("deload");
    expect(planA!.workout.mode === "full" || planA!.workout.mode === "rest").toBe(true);
    expect(planB!.why.some((w) => /sono/i.test(w))).toBe(true);
    expect(planA!.narrative).not.toEqual(planB!.narrative);
    expect(planB!.nutrition.proteinG).toBeGreaterThanOrEqual(planA!.nutrition.proteinG);
  });
});

describe("buildLivingPlan — adaptação pós check-in de sono", () => {
  it("reduz volume e explica no Why após sono ruim", () => {
    const date = todayKey();
    const base = stateWith({
      ...baseProfile,
      typicalSleepHours: 8,
    });

    const before = buildLivingPlan(base, date);
    expect(before).not.toBeNull();

    const afterState: AppState = {
      ...base,
      dayCheckIns: {
        [date]: {
          date,
          sleepHours: 5,
          energy: "baixa",
          availableMin: 60,
        },
      },
      livingPlans: before ? { [date]: before } : {},
    };

    const after = buildLivingPlan(afterState, date);
    expect(after).not.toBeNull();
    expect(after!.workout.volumeFactor).toBeLessThan(before!.workout.volumeFactor);
    expect(after!.workout.mode).toBe("deload");
    expect(after!.why.some((w) => /sono/i.test(w) && /volume/i.test(w))).toBe(true);
    expect(after!.narrative).toMatch(/recuperado|volume/i);
  });
});
