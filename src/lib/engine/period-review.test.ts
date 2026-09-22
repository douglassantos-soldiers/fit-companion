import { describe, expect, it } from "vitest";
import { periodReview } from "@/lib/engine/period-review";
import { emptyState, type AppState, type Profile, type SessionLog } from "@/lib/types";

const profile: Profile = {
  name: "Ritual",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 4,
  age: 30,
  heightCm: 180,
  weightKg: 82,
  equipment: "academia",
  restrictions: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

function session(date: string, weightKg = 80): SessionLog {
  return {
    id: `s-${date}`,
    dayId: `day-${date}`,
    title: "Treino A",
    date,
    durationMin: 45,
    volumeKg: weightKg * 8 * 2,
    exercises: [
      {
        exerciseId: "supino-reto",
        sets: [
          { reps: 8, weightKg, done: true },
          { reps: 8, weightKg, done: true },
        ],
      },
    ],
  };
}

function stateWith(sessions: SessionLog[]): AppState {
  return {
    ...emptyState,
    profile,
    sessions,
    dayCheckIns: {},
    livingPlans: {},
  };
}

describe("periodReview", () => {
  it("usa RITUAL DA SEMANA no domingo e inclui adherence + nextBlock", () => {
    const sunday = new Date("2026-09-20T15:00:00-03:00"); // Sunday
    const review = periodReview(
      stateWith([
        session("2026-09-15"),
        session("2026-09-16"),
        session("2026-09-18"),
      ]),
      "week",
      sunday,
    );

    expect(review.label).toBe("RITUAL DA SEMANA");
    expect(review.isSundayRitual).toBe(true);
    expect(review.sessions).toBe(3);
    expect(review.adherencePct).toBeGreaterThanOrEqual(0);
    expect(review.adherencePct).toBeLessThanOrEqual(100);
    expect(review.nextBlock).not.toBeNull();
    expect(review.nextBlock!.days.length).toBeGreaterThan(0);
    expect(review.nextBlock!.label.toLowerCase()).toMatch(/próxim|semana|bloco/);
  });

  it("mantém SEU RESUMO em dia útil", () => {
    const monday = new Date("2026-09-21T12:00:00-03:00");
    const review = periodReview(stateWith([session("2026-09-21")]), "week", monday);
    expect(review.label).toBe("SEU RESUMO");
    expect(review.isSundayRitual).toBe(false);
  });

  it("expõe Strength Score quando há histórico composto", () => {
    const now = new Date("2026-09-21T12:00:00-03:00");
    const heavy: SessionLog = {
      id: "heavy",
      dayId: "day-heavy",
      title: "Força",
      date: "2026-09-18",
      durationMin: 50,
      volumeKg: 1500,
      exercises: [
        {
          exerciseId: "supino-reto",
          sets: [
            { reps: 5, weightKg: 100, done: true },
            { reps: 5, weightKg: 100, done: true },
            { reps: 5, weightKg: 100, done: true },
          ],
        },
      ],
    };
    const review = periodReview(stateWith([heavy]), "week", now);
    expect(review.strengthScore).not.toBeNull();
    expect(review.strengthScore!).toBeGreaterThan(0);
  });
});
