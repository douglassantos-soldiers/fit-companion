import { describe, expect, it } from "vitest";
import { emptyState, type Profile } from "@/lib/types";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { materializeLivingPlan } from "@/lib/engine/living-plan-materialize";
import { buildContextSnapshot } from "@/lib/engine/context-snapshot";
import { computeDecisions } from "@/lib/engine/decision";
import { evaluateSafetyForDate } from "@/lib/engine/safety";
import { computeRecoverySnapshot } from "@/lib/engine/recovery";
import { computeLearningSnapshot } from "@/lib/engine/learning";
import { buildExpressSession } from "@/lib/engine/plan";
import { activeBlockFromProgram, buildWeeklyPlanFromBlock } from "@/lib/training/training-block";
import {
  CONTENT_OS_PROGRAMS,
  CONTENT_OS_PROGRAM_SESSIONS,
} from "@/data/content-os-seed";

const profile: Profile = {
  name: "Test",
  goal: "performance",
  level: "iniciante",
  equipment: "academia",
  daysPerWeek: 3,
  trainingWeekdays: [1, 3, 5],
  restrictions: [],
  weightKg: 80,
  heightCm: 178,
  age: 28,
  typicalSleepHours: 7,
  typicalSessionMin: 55,
};

describe("hybrid block + living plan", () => {
  const program = CONTENT_OS_PROGRAMS.find((p) => p.id === "program-base-4w")!;
  const block = activeBlockFromProgram(program, CONTENT_OS_PROGRAM_SESSIONS, "2026-09-21")!;

  it("enroll → PlannedDay with seed exercises", () => {
    const days = buildWeeklyPlanFromBlock(block, profile, "2026-09-21");
    expect(days[0]!.exercises.some((e) => e.exerciseId === "supino-reto")).toBe(true);
  });

  it("assemble uses block prescriptions for planned day", () => {
    const state = {
      ...emptyState,
      profile,
      activeTrainingBlock: block,
    };
    const snap = assembleDecisionContext(state, {
      date: "2026-09-21",
      source: "offline_legacy",
    });
    expect(snap).not.toBeNull();
    expect(snap!.livingPlan.workout.title).toMatch(/Empurrar|Descanso|leve|express/i);
  });

  it("materialize express shortens block day", () => {
    const state = { ...emptyState, profile, activeTrainingBlock: block };
    const date = "2026-09-21";
    const day = buildWeeklyPlanFromBlock(block, profile, date)[0]!;
    const recovery = computeRecoverySnapshot(state, date);
    const learning = computeLearningSnapshot(state, date);
    const context = buildContextSnapshot(state, date, "u1", recovery, learning)!;
    const safety = evaluateSafetyForDate(state, date, recovery);
    const decisions = computeDecisions(context, safety, {
      plannedMinutes: day.estimatedMin,
      hasTrainingDay: true,
    });
    // Force express path via bundle clone
    const expressBundle = { ...decisions, trainingMode: "express" as const, sessionDuration: 30 };
    const living = materializeLivingPlan({
      state,
      date,
      snapshot: context,
      safety,
      bundle: expressBundle,
      day,
      recovery,
      learning,
    });
    expect(living).not.toBeNull();
    const expressDay = buildExpressSession(day);
    expect(expressDay.exercises.length).toBeLessThanOrEqual(day.exercises.length);
    expect(living!.plan.workout.title.toLowerCase()).toContain("express");
  });
});
