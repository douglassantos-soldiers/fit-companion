/**
 * Recovery Intelligence — one snapshot for Today / Training / Coach / Safety.
 */
import { describe, expect, it } from "vitest";
import { computeRecoverySnapshot } from "@/lib/engine/recovery/snapshot";
import { evaluateSafetyForDate } from "@/lib/engine/safety";
import { computeDecisions } from "@/lib/engine/decision";
import { buildContextSnapshot } from "@/lib/engine/context-snapshot";
import { emptyState, todayKey, type AppState, type Profile, type SessionLog } from "@/lib/types";

const date = todayKey();

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

function stateWith(extras: Partial<AppState> = {}): AppState {
  return { ...emptyState, profile: baseProfile, dayCheckIns: {}, ...extras };
}

function checkIn(patch: Partial<AppState["dayCheckIns"][string]> = {}) {
  return {
    date,
    sleepHours: 8,
    energy: "alta" as const,
    availableMin: 60,
    ...patch,
  };
}

function hardSessions(n: number): SessionLog[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - i);
    return {
      id: `h${i}`,
      dayId: "a",
      title: "Hard",
      date: d.toISOString().slice(0, 10),
      durationMin: 50,
      exercises: [],
      volumeKg: 2000,
      rpe: "dificil" as const,
    };
  });
}

function peitoLoadSessions(): SessionLog[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - i);
    return {
      id: `p${i}`,
      dayId: "p",
      title: "Peito",
      date: d.toISOString().slice(0, 10),
      durationMin: 50,
      volumeKg: 4000,
      exercises: [
        {
          exerciseId: "supino-reto",
          sets: Array.from({ length: 5 }, (__, s) => ({
            reps: 8,
            weightKg: 60,
            done: true,
            completed: true,
          })),
        },
      ],
    };
  });
}

describe("RecoverySnapshot", () => {
  it("healthy check-in → high readiness, not fatigued", () => {
    const snap = computeRecoverySnapshot(
      stateWith({ dayCheckIns: { [date]: checkIn({ soreness: 1, stress: 1 }) } }),
      date,
    );
    expect(snap.readiness).toBe("high");
    expect(snap.level).toBe("recovered");
    expect(snap.score).toBeGreaterThanOrEqual(70);
    expect(snap.fatigueSignal).toBe(false);
    expect(snap.sleepConfidence).toBeGreaterThan(0.7);
    expect(snap.sourceSummary.sleep).toBe("checkin");
  });

  it("low sleep → low + sleep_low with high sleep confidence", () => {
    const snap = computeRecoverySnapshot(
      stateWith({ dayCheckIns: { [date]: checkIn({ sleepHours: 4.5, energy: "ok" }) } }),
      date,
    );
    expect(snap.readiness).toBe("low");
    expect(snap.reasonCodes).toContain("sleep_low");
    expect(snap.sleepConfidence).toBeGreaterThan(0.7);
  });

  it("high soreness → low + recovery_low", () => {
    const snap = computeRecoverySnapshot(
      stateWith({
        dayCheckIns: { [date]: checkIn({ sleepHours: 7.5, energy: "ok", soreness: 4 }) },
      }),
      date,
    );
    expect(snap.readiness).toBe("low");
    expect(snap.reasonCodes).toContain("recovery_low");
    expect(snap.soreness).toBe(4);
  });

  it("high stress penalizes and can mark recovery_low", () => {
    const snap = computeRecoverySnapshot(
      stateWith({
        dayCheckIns: { [date]: checkIn({ sleepHours: 7.5, energy: "ok", stress: 5 }) },
      }),
      date,
    );
    expect(snap.stress).toBe(5);
    expect(snap.reasonCodes).toContain("recovery_low");
    expect((snap.score ?? 100) < 72).toBe(true);
  });

  it("hard RPE streak ≥ 2 → fatigue / rpe_high", () => {
    const snap = computeRecoverySnapshot(stateWith({ sessions: hardSessions(2) }), date);
    expect(snap.readiness).toBe("low");
    expect(snap.fatigueSignal).toBe(true);
    expect(snap.reasonCodes).toContain("rpe_high");
    expect(snap.hardRpeStreak).toBeGreaterThanOrEqual(2);
  });

  it("high muscle load raises fatigueContribution / fatigued status", () => {
    const snap = computeRecoverySnapshot(stateWith({ sessions: peitoLoadSessions() }), date);
    const peito = snap.muscles.find((m) => m.muscle === "peito");
    expect(peito).toBeTruthy();
    expect(peito!.directLoad7d).toBeGreaterThan(0);
    expect(peito!.fatigueContribution).toBeGreaterThan(0);
    expect(["fatigued", "ok", "fresh"]).toContain(peito!.status);
  });

  it("low data confidence → unknown, not treated as bad recovery", () => {
    const snap = computeRecoverySnapshot(stateWith(), date);
    expect(snap.readiness).toBe("unknown");
    expect(snap.score).toBeNull();
    expect(snap.level).toBe("unknown");
    expect(snap.fatigueSignal).toBe(false);
    expect(snap.reasonCodes).not.toContain("sleep_low");
    expect(snap.reasonCodes).not.toContain("recovery_low");

    const safety = evaluateSafetyForDate(stateWith(), date, snap);
    expect(safety.flags).not.toContain("under_recovery");

    const ctx = buildContextSnapshot(stateWith(), date, "u1", snap);
    expect(ctx?.recovery.readiness).toBe("unknown");
    expect(ctx?.recovery.level).toBe("unknown");
    const bundle = computeDecisions(ctx!, safety, { plannedMinutes: 60, hasTrainingDay: true });
    expect(bundle.trainingMode).not.toBe("rest");
    expect(bundle.trainingVolume).toBeGreaterThan(0);
  });

  it("wearable HRV/RHR raises wearable confidence and sourceSummary", () => {
    const snap = computeRecoverySnapshot(stateWith(), date, {
      wearable: { hrv: 70, restingHr: 52 },
    });
    expect(snap.sourceSummary.wearable).toBe(true);
    expect(snap.wearableConfidence).toBeGreaterThan(0);
    expect(snap.wearable.hrv).toBe(70);
    expect(snap.readiness).not.toBe("unknown");
  });

  it("conflicting wearable good + Safety escalate → Decision rest, snapshot does not clear flags", () => {
    const state = stateWith({
      dayCheckIns: {
        [date]: checkIn({
          sleepHours: 8,
          energy: "alta",
          soreness: 1,
          notes: "dor no peito forte",
        }),
      },
    });
    const snap = computeRecoverySnapshot(state, date, {
      wearable: { hrv: 80, restingHr: 50 },
    });
    expect(snap.readiness).not.toBe("low");
    const safety = evaluateSafetyForDate(state, date, snap);
    expect(safety.escalateCare).toBe(true);
    const ctx = buildContextSnapshot(state, date, "u1", snap);
    expect(ctx).toBeTruthy();
    const bundle = computeDecisions(ctx!, safety, { plannedMinutes: 60, hasTrainingDay: true });
    expect(bundle.trainingMode).toBe("rest");
    expect(bundle.trainingVolume).toBe(0);
    expect(safety.flags).toContain("escalate_care");
  });

  it("typicalSleepHours is not treated as today's sleep_low", () => {
    const state = stateWith({ profile: { ...baseProfile, typicalSleepHours: 5 } });
    const snap = computeRecoverySnapshot(state, date);
    expect(snap.readiness).toBe("unknown");
    expect(snap.reasonCodes).not.toContain("sleep_low");
    expect(snap.sourceSummary.sleep).toBe("none");
    const ctx = buildContextSnapshot(state, date, "u1", snap);
    expect(ctx).toBeTruthy();
    const safety = evaluateSafetyForDate(state, date, snap);
    const bundle = computeDecisions(ctx!, safety, { plannedMinutes: 60, hasTrainingDay: true });
    expect(safety.flags).not.toContain("under_recovery");
    expect(bundle.trainingMode).not.toBe("rest");
  });
});
