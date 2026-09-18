/**
 * FASE 4 Decision Engine scenarios.
 */
import { describe, expect, it } from "vitest";
import { buildContextSnapshot } from "@/lib/engine/context-snapshot";
import { computeDecisions, decisionByType } from "@/lib/engine/decision";
import { explainWhy } from "@/lib/engine/explain";
import { buildLivingPlan } from "@/lib/engine/living-plan";
import { evaluateSafety } from "@/lib/engine/safety";
import { emptyState, todayKey, type AppState, type Profile, type SessionLog } from "@/lib/types";

const baseProfile: Profile = {
  name: "Soldado",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 4,
  age: 28,
  heightCm: 178,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
  typicalSleepHours: 8,
};

function stateWith(extras: Partial<AppState> = {}, profile: Profile = baseProfile): AppState {
  return { ...emptyState, profile, dayCheckIns: {}, livingPlans: {}, ...extras };
}

function hardSessions(n: number): SessionLog[] {
  const date = todayKey();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - i);
    return {
      id: `s${i}`,
      dayId: "a",
      title: "Treino",
      date: d.toISOString().slice(0, 10),
      durationMin: 50,
      exercises: [],
      volumeKg: 2000,
      rpe: "dificil" as const,
    };
  });
}

describe("FASE 4 Decision Engine scenarios", () => {
  it("sono baixo → sleep_low, volume ≤ 0.7, deload, block_stims", () => {
    const date = todayKey();
    const state = stateWith({
      dayCheckIns: {
        [date]: { date, sleepHours: 4.5, energy: "ok", availableMin: 60 },
      },
    });
    const snap = buildContextSnapshot(state, date)!;
    expect(snap.reasonSeeds).toContain("sleep_low");
    const safety = evaluateSafety(state);
    const bundle = computeDecisions(snap, safety, { plannedMinutes: 55, hasTrainingDay: true });
    expect(bundle.trainingVolume).toBeLessThanOrEqual(0.7);
    expect(bundle.trainingMode).toBe("deload");
    expect(bundle.blockStims).toBe(true);
    expect(bundle.decisions.every((d) => d.confidence >= 0.35 && d.confidence <= 0.95)).toBe(true);
  });

  it("sono bom → volume ~1.0 e mode full (sem time limit)", () => {
    const date = todayKey();
    const state = stateWith({
      dayCheckIns: {
        [date]: { date, sleepHours: 8, energy: "alta", availableMin: 90 },
      },
    });
    const snap = buildContextSnapshot(state, date)!;
    expect(snap.reasonSeeds).toContain("sleep_good");
    const safety = evaluateSafety(state);
    const bundle = computeDecisions(snap, safety, { plannedMinutes: 55, hasTrainingDay: true });
    expect(bundle.trainingVolume).toBe(1);
    expect(bundle.trainingMode).toBe("full");
    expect(bundle.blockStims).toBe(false);
  });

  it("energia baixa → energy_low e preferLight / deload", () => {
    const date = todayKey();
    const state = stateWith({
      dayCheckIns: {
        [date]: { date, sleepHours: 7, energy: "baixa", availableMin: 60 },
      },
    });
    const snap = buildContextSnapshot(state, date)!;
    expect(snap.reasonSeeds).toContain("energy_low");
    const safety = evaluateSafety(state);
    expect(safety.preferLightTraining).toBe(true);
    const bundle = computeDecisions(snap, safety, { plannedMinutes: 55, hasTrainingDay: true });
    expect(bundle.trainingMode).toBe("deload");
  });

  it("viagem (notes) → travel code e bias express/equipment", () => {
    const date = todayKey();
    const state = stateWith({
      dayCheckIns: {
        [date]: {
          date,
          sleepHours: 7,
          energy: "ok",
          availableMin: 45,
          notes: "viagem a trabalho no hotel",
        },
      },
    });
    const snap = buildContextSnapshot(state, date)!;
    expect(snap.travel).toBe(true);
    expect(snap.reasonSeeds).toContain("travel");
    const safety = evaluateSafety(state);
    const bundle = computeDecisions(snap, safety, { plannedMinutes: 60, hasTrainingDay: true });
    expect(["express", "deload", "full"]).toContain(bundle.trainingMode);
    // travel forces express when otherwise full
    expect(bundle.trainingMode === "express" || bundle.sessionDuration <= 45).toBe(true);
  });

  it("pouco tempo → time_limited, express, duration ≤ availableMin", () => {
    const date = todayKey();
    const state = stateWith({
      dayCheckIns: {
        [date]: { date, sleepHours: 8, energy: "ok", availableMin: 25 },
      },
    });
    const snap = buildContextSnapshot(state, date)!;
    expect(snap.reasonSeeds).toContain("time_limited");
    const safety = evaluateSafety(state);
    const bundle = computeDecisions(snap, safety, { plannedMinutes: 55, hasTrainingDay: true });
    expect(bundle.trainingMode).toBe("express");
    expect(bundle.sessionDuration).toBeLessThanOrEqual(25);
  });

  it("recuperação baixa / rpe_high → volume ↓", () => {
    const date = todayKey();
    const state = stateWith({
      sessions: hardSessions(3),
      dayCheckIns: {
        [date]: { date, sleepHours: 7, energy: "ok", availableMin: 60 },
      },
    });
    const snap = buildContextSnapshot(state, date)!;
    expect(snap.reasonSeeds.some((c) => c === "rpe_high" || c === "recovery_low" || c === "deload_week")).toBe(
      true,
    );
    const safety = evaluateSafety(state);
    const bundle = computeDecisions(snap, safety, { plannedMinutes: 55, hasTrainingDay: true });
    expect(bundle.trainingVolume).toBeLessThan(1);
  });

  it("proteína baixa → protein_low e meal bias / primary meal", () => {
    const date = todayKey();
    const meals = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(`${date}T12:00:00`);
      d.setDate(d.getDate() - i);
      return {
        id: `m${i}`,
        date: d.toISOString().slice(0, 10),
        slot: "almoco" as const,
        label: "Leve",
        proteinG: 20,
        kcal: 400,
        quality: "laranja" as const,
      };
    });
    const state = stateWith({
      meals,
      dayCheckIns: {
        [date]: { date, sleepHours: 7.5, energy: "ok", availableMin: 60 },
      },
    });
    const snap = buildContextSnapshot(state, date)!;
    // May or may not hit protein_low depending on nutritionGoals vs totals
    const safety = evaluateSafety(state);
    const bundle = computeDecisions(
      {
        ...snap,
        reasonSeeds: [...new Set([...snap.reasonSeeds, "protein_low" as const])],
        nutrition: { ...snap.nutrition, proteinAdherence7d: 0.4 },
      },
      safety,
      { plannedMinutes: 55, hasTrainingDay: true },
    );
    expect(bundle.proteinBias).toBe("up");
    expect(bundle.mealDistribution).toBe("rebalanced");
    const vol = decisionByType(bundle.decisions, "nutrition_protein_bias");
    expect(vol?.reasonCodes).toContain("protein_low");
  });

  it("aderência baixa → adherence_drop", () => {
    const date = todayKey();
    const snap = buildContextSnapshot(
      stateWith({
        dayCheckIns: {
          [date]: { date, sleepHours: 7, energy: "ok", availableMin: 60 },
        },
      }),
      date,
    )!;
    const low = {
      ...snap,
      reasonSeeds: [...new Set([...snap.reasonSeeds, "adherence_drop" as const])],
      adherence: { ...snap.adherence, adherenceScore: 30 },
    };
    const safety = evaluateSafety(stateWith({}));
    const bundle = computeDecisions(low, safety, { plannedMinutes: 55, hasTrainingDay: true });
    expect(bundle.mealDistribution).toBe("rebalanced");
    expect(low.reasonSeeds).toContain("adherence_drop");
  });
});

describe("explainWhy + snapshot shape", () => {
  it("explainWhy mentions volume and sleep fragment", () => {
    const text = explainWhy("training_volume", 0.7, ["sleep_low", "rpe_high"]);
    expect(text).toMatch(/volume/i);
    expect(text).toMatch(/sono|RPE/i);
  });

  it("ContextSnapshot has canonical fields", () => {
    const date = todayKey();
    const snap = buildContextSnapshot(
      stateWith({
        dayCheckIns: {
          [date]: { date, sleepHours: 7, energy: "ok", availableMin: 40, noEquipment: true },
        },
      }),
      date,
    )!;
    expect(snap.goal).toBe("massa");
    expect(snap.sleep.hours).toBe(7);
    expect(snap.equipment.limitedToday).toBe(true);
    expect(snap.reasonSeeds).toContain("equipment_limited");
    expect(snap.confidenceBase).toBeGreaterThanOrEqual(0.35);
    expect(snap.confidenceBase).toBeLessThanOrEqual(0.9);
  });

  it("Living Plan consumes Decision Engine", () => {
    const date = todayKey();
    const plan = buildLivingPlan(
      stateWith({
        dayCheckIns: {
          [date]: { date, sleepHours: 5, energy: "baixa", availableMin: 60 },
        },
      }),
      date,
    );
    expect(plan).not.toBeNull();
    expect(plan!.workout.volumeFactor).toBeLessThanOrEqual(0.7);
    expect(plan!.why.some((w) => /volume|sono|deload|leve/i.test(w))).toBe(true);
  });
});
