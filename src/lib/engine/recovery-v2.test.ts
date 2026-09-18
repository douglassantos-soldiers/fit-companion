/**
 * FASE 5 Recovery Engine v2 tests.
 */
import { describe, expect, it } from "vitest";
import { computeRecoveryV2 } from "@/lib/engine/recovery-v2";
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

function stateWith(extras: Partial<AppState> = {}): AppState {
  return { ...emptyState, profile: baseProfile, dayCheckIns: {}, ...extras };
}

describe("Recovery Engine v2", () => {
  it("wearable signals are always null", () => {
    const date = todayKey();
    const v2 = computeRecoveryV2(
      stateWith({
        dayCheckIns: {
          [date]: { date, sleepHours: 8, energy: "alta", availableMin: 60, soreness: 1, stress: 1 },
        },
      }),
      date,
    );
    expect(v2.signals.wearable.hrv).toBeNull();
    expect(v2.signals.wearable.restingHr).toBeNull();
    expect(v2.signals.wearable.source).toBeNull();
    expect(v2.manualOnly).toBe(true);
    expect(v2.explanation).toMatch(/Sem wearable/i);
  });

  it("recovered when sleep/energy good and no fatigue", () => {
    const date = todayKey();
    const v2 = computeRecoveryV2(
      stateWith({
        dayCheckIns: {
          [date]: { date, sleepHours: 8, energy: "alta", availableMin: 60, soreness: 1, stress: 1 },
        },
      }),
      date,
    );
    expect(v2.level).toBe("recovered");
    expect(v2.score).toBeGreaterThanOrEqual(70);
  });

  it("low when sleep < 6", () => {
    const date = todayKey();
    const v2 = computeRecoveryV2(
      stateWith({
        dayCheckIns: {
          [date]: { date, sleepHours: 4.5, energy: "ok", availableMin: 60 },
        },
      }),
      date,
    );
    expect(v2.level).toBe("low");
    expect(v2.reasonCodes).toContain("sleep_low");
  });

  it("low when energy baixa or soreness ≥ 4", () => {
    const date = todayKey();
    const lowEnergy = computeRecoveryV2(
      stateWith({
        dayCheckIns: {
          [date]: { date, sleepHours: 7.5, energy: "baixa", availableMin: 60 },
        },
      }),
      date,
    );
    expect(lowEnergy.level).toBe("low");

    const sore = computeRecoveryV2(
      stateWith({
        dayCheckIns: {
          [date]: { date, sleepHours: 7.5, energy: "ok", availableMin: 60, soreness: 4 },
        },
      }),
      date,
    );
    expect(sore.level).toBe("low");
    expect(sore.signals.manual.soreness).toBe(4);
  });

  it("low when hard RPE streak ≥ 2", () => {
    const date = todayKey();
    const sessions: SessionLog[] = [0, 1].map((i) => {
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
    const v2 = computeRecoveryV2(stateWith({ sessions }), date);
    expect(v2.level).toBe("low");
    expect(v2.reasonCodes).toContain("rpe_high");
  });

  it("uses soreness and stress from check-in in manual signals", () => {
    const date = todayKey();
    const v2 = computeRecoveryV2(
      stateWith({
        dayCheckIns: {
          [date]: {
            date,
            sleepHours: 7,
            energy: "ok",
            availableMin: 45,
            soreness: 2,
            stress: 3,
          },
        },
      }),
      date,
    );
    expect(v2.signals.manual.soreness).toBe(2);
    expect(v2.signals.manual.stress).toBe(3);
    expect(v2.confidence).toBeGreaterThan(0.5);
  });
});
