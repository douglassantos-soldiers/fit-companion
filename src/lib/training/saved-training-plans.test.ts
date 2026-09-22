import { describe, expect, it } from "vitest";
import {
  forkDayPlan,
  forkWeekPlan,
  isStickyPlanActive,
  mergeSavedTrainingPlans,
  plannedDaysFromSaved,
  removeSavedTrainingPlan,
  upsertSavedTrainingPlan,
} from "@/lib/training/saved-training-plans";
import type { PlannedDay } from "@/lib/training/plan";
import { weekStartKey } from "@/lib/engine/xp";

const sampleDay = (id: string, title: string): PlannedDay => ({
  id,
  weekday: 1,
  title,
  focus: "peito",
  estimatedMin: 45,
  exercises: [
    {
      exerciseId: "supino-reto",
      name: "Supino reto",
      sets: 3,
      reps: "8-10",
      restSec: 90,
      suggestedLoad: 60,
      unit: "kg",
    },
  ],
});

describe("saved-training-plans", () => {
  it("forks a week and round-trips to PlannedDay", () => {
    const days = [sampleDay("d1", "A"), sampleDay("d2", "B")];
    const plan = forkWeekPlan(days, "Minha semana");
    expect(plan.kind).toBe("week");
    expect(plan.days).toHaveLength(2);
    const back = plannedDaysFromSaved(plan.days);
    expect(back[0]!.exercises[0]!.exerciseId).toBe("supino-reto");
    expect(back[0]!.exercises[0]!.suggestedLoad).toBe(60);
  });

  it("forks a single day", () => {
    const plan = forkDayPlan(sampleDay("d1", "Peito"));
    expect(plan.kind).toBe("day");
    expect(plan.name).toBe("Peito");
    expect(plan.days).toHaveLength(1);
  });

  it("caps and merges by updatedAt", () => {
    const a = forkWeekPlan([sampleDay("d1", "A")], "A");
    const b = { ...a, name: "A2", updatedAt: "2099-01-01T00:00:00.000Z" };
    const merged = mergeSavedTrainingPlans([a], [b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.name).toBe("A2");
    const many = Array.from({ length: 25 }, (_, i) =>
      forkWeekPlan([sampleDay(`d${i}`, `D${i}`)], `P${i}`),
    );
    expect(upsertSavedTrainingPlan(many.slice(1), many[0]!).length).toBe(20);
    expect(removeSavedTrainingPlan(many, many[0]!.id).every((p) => p.id !== many[0]!.id)).toBe(
      true,
    );
  });

  it("sticky only for current ISO week", () => {
    const plan = forkWeekPlan([sampleDay("d1", "A")]);
    const week = weekStartKey();
    expect(
      isStickyPlanActive({
        activeTrainingPlanId: plan.id,
        activeTrainingPlanWeekKey: week,
        savedTrainingPlans: [plan],
      })?.id,
    ).toBe(plan.id);
    expect(
      isStickyPlanActive({
        activeTrainingPlanId: plan.id,
        activeTrainingPlanWeekKey: "2000-01-01",
        savedTrainingPlans: [plan],
      }),
    ).toBeNull();
  });
});
