import { describe, expect, it } from "vitest";
import { emptyState, type Profile } from "@/lib/types";
import { fingerprintDecisionInputs, DECISION_ENGINE_VERSION } from "@/lib/engine/decision-context-snapshot";
import { periodReview } from "@/lib/engine/period-review";
import {
  hasPrescribedPlan,
  planSourceFingerprint,
  resolveTrainingPlanDays,
} from "@/lib/training/resolve-plan-days";
import {
  activeBlockFromProgram,
  completeBlockDay,
  scalePlannedDayVolume,
} from "@/lib/training/training-block";
import { forkWeekPlan } from "@/lib/training/saved-training-plans";
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
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("polish resolve + fingerprint", () => {
  const program = CONTENT_OS_PROGRAMS.find((p) => p.id === "program-base-4w")!;
  const block = activeBlockFromProgram(program, CONTENT_OS_PROGRAM_SESSIONS, "2026-09-21")!;

  it("prioritizes block over sticky over generated", () => {
    const sticky = forkWeekPlan(
      resolveTrainingPlanDays({ ...emptyState, profile }),
      "Minha rotina",
    );
    const withSticky = {
      ...emptyState,
      profile,
      savedTrainingPlans: [sticky],
      activeTrainingPlanId: sticky.id,
      activeTrainingPlanWeekKey: "2026-09-21",
    };
    expect(hasPrescribedPlan(withSticky, "2026-09-21")).toBe(true);

    const withBlock = { ...withSticky, activeTrainingBlock: block };
    const days = resolveTrainingPlanDays(withBlock, "2026-09-21");
    expect(days[0]!.id).toContain("program-base-4w");
  });

  it("planSourceFingerprint changes on enroll", () => {
    const base = planSourceFingerprint({ ...emptyState, profile }, "2026-09-21");
    const enrolled = planSourceFingerprint(
      { ...emptyState, profile, activeTrainingBlock: block },
      "2026-09-21",
    );
    expect(base).toBe("generated");
    expect(enrolled.startsWith("block:")).toBe(true);
    expect(enrolled).not.toBe(base);

    const fpA = fingerprintDecisionInputs({
      date: "2026-09-21",
      timezone: "America/Sao_Paulo",
      customer360Version: null,
      engineVersion: DECISION_ENGINE_VERSION,
      sleepHours: 7,
      energy: "ok",
      availableTimeMin: 60,
      equipmentProfile: "academia",
      equipmentLimitedToday: false,
      acceptedTrainingMode: null,
      recoveryScore: 70,
      recoveryLevel: "ok",
      proteinAdherence7d: 0.8,
      plannedMinutes: 50,
      hasTrainingDay: true,
      reasonSeeds: [],
      behaviorTriggers: [],
      planSource: base,
    });
    const fpB = fingerprintDecisionInputs({
      date: "2026-09-21",
      timezone: "America/Sao_Paulo",
      customer360Version: null,
      engineVersion: DECISION_ENGINE_VERSION,
      sleepHours: 7,
      energy: "ok",
      availableTimeMin: 60,
      equipmentProfile: "academia",
      equipmentLimitedToday: false,
      acceptedTrainingMode: null,
      recoveryScore: 70,
      recoveryLevel: "ok",
      proteinAdherence7d: 0.8,
      plannedMinutes: 50,
      hasTrainingDay: true,
      reasonSeeds: [],
      behaviorTriggers: [],
      planSource: enrolled,
    });
    expect(fpA).not.toBe(fpB);
  });

  it("period-review nextBlock uses active block", () => {
    const review = periodReview(
      { ...emptyState, profile, activeTrainingBlock: block },
      "week",
      new Date("2026-09-21T12:00:00"),
    );
    expect(review.nextBlock?.label.toLowerCase()).toMatch(/trilha|bloco/);
    expect(review.nextBlock?.days.length).toBeGreaterThan(0);
  });

  it("archive keeps last completed dayId", () => {
    let cur = block;
    let last: ReturnType<typeof completeBlockDay> | null = null;
    for (const w of block.weeks) {
      for (const d of w.days) {
        last = completeBlockDay(cur, d.id);
        cur = last.block;
      }
    }
    expect(last!.finished).toBe(true);
    const lastDayId = block.weeks[3]!.days[2]!.id;
    expect(last!.block.completedDayIds).toContain(lastDayId);
  });

  it("scalePlannedDayVolume reduces sets and load", () => {
    const day = resolveTrainingPlanDays(
      { ...emptyState, profile, activeTrainingBlock: block },
      "2026-09-21",
    )[0]!;
    const scaled = scalePlannedDayVolume(day, 0.7, (n) => Math.round(n * 2) / 2);
    expect(scaled.exercises[0]!.sets).toBeLessThanOrEqual(day.exercises[0]!.sets);
    expect(scaled.estimatedMin).toBeLessThan(day.estimatedMin);
  });
});
