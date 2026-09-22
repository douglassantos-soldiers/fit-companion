import { describe, expect, it } from "vitest";
import { computeStrengthScore } from "@/lib/training/strength-score";
import type { Profile, SessionLog } from "@/lib/types";

const profile: Profile = {
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

function session(
  id: string,
  date: string,
  exercises: Array<{ exerciseId: string; weightKg: number; reps: number }>,
): SessionLog {
  return {
    id,
    dayId: "dia-1",
    title: "Teste",
    date,
    durationMin: 45,
    volumeKg: exercises.reduce((s, e) => s + e.reps * e.weightKg * 3, 0),
    exercises: exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: [
        { reps: e.reps, weightKg: e.weightKg, done: true },
        { reps: e.reps, weightKg: e.weightKg, done: true },
        { reps: e.reps, weightKg: e.weightKg, done: true },
      ],
    })),
  };
}

describe("strength-score", () => {
  it("cold-starts when evidence is thin", () => {
    const sessions = [session("s1", "2026-09-01", [{ exerciseId: "supino-reto", weightKg: 60, reps: 8 }])];
    const result = computeStrengthScore(sessions, profile);
    expect(result.coldStart).toBe(true);
    expect(result.evidenceCount).toBeLessThan(2);
    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("scores multi-lift relative strength", () => {
    const sessions = [
      session("s1", "2026-09-01", [
        { exerciseId: "supino-reto", weightKg: 80, reps: 5 },
        { exerciseId: "agachamento", weightKg: 100, reps: 5 },
        { exerciseId: "levantamento-terra", weightKg: 120, reps: 5 },
        { exerciseId: "barra-fixa", weightKg: 70, reps: 6 },
      ]),
      session("s2", "2026-09-08", [
        { exerciseId: "supino-reto", weightKg: 82.5, reps: 5 },
        { exerciseId: "agachamento", weightKg: 105, reps: 5 },
        { exerciseId: "levantamento-terra", weightKg: 125, reps: 5 },
        { exerciseId: "barra-fixa", weightKg: 72.5, reps: 6 },
      ]),
    ];
    const result = computeStrengthScore(sessions, profile);
    expect(result.coldStart).toBe(false);
    expect(result.evidenceCount).toBeGreaterThanOrEqual(2);
    expect(result.lifts.length).toBeGreaterThanOrEqual(2);
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThanOrEqual(100);
    for (const lift of result.lifts) {
      expect(lift.estimated1rm).toBeGreaterThan(0);
      expect(lift.relativeBw).toBeGreaterThan(0);
    }
  });

  it("uses level fallback when no sessions", () => {
    const beginner = computeStrengthScore([], { ...profile, level: "iniciante" });
    const advanced = computeStrengthScore([], { ...profile, level: "avancado" });
    expect(beginner.coldStart).toBe(true);
    expect(advanced.score).toBeGreaterThan(beginner.score);
  });
});
