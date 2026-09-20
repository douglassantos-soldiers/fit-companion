/**
 * Deep Training Engine — exercise history, plateau, prefs in planner.
 */
import { describe, expect, it } from "vitest";
import {
  detectPlateau,
  hitsForExercise,
  listExercisesWithHistory,
  summarizeExercise,
  trendFromHits,
  type ExerciseHit,
} from "@/lib/engine/exercise-history";
import { buildWeeklyPlanDetailed } from "@/lib/engine/plan";
import { suggestProgression } from "@/lib/engine/progression";
import { muscleRecoveryMap } from "@/lib/engine/recovery";
import { emptyState, type Profile, type SessionLog } from "@/lib/types";

const profile: Profile = {
  name: "Teste",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 3,
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
  exerciseId: string,
  sets: Array<{ reps: number; weightKg: number; done?: boolean }>,
  rpe?: SessionLog["rpe"],
): SessionLog {
  return {
    id,
    dayId: "dia-1",
    title: "Teste",
    date,
    durationMin: 45,
    volumeKg: sets.reduce((s, x) => s + x.reps * x.weightKg, 0),
    exercises: [
      {
        exerciseId,
        sets: sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg, done: s.done ?? true })),
      },
    ],
    ...(rpe ? { rpe } : {}),
  };
}

function flatHits(n: number, weight = 70): ExerciseHit[] {
  return Array.from({ length: n }, (_, i) => ({
    sessionId: `s${i}`,
    date: `2026-09-${String(18 - i).padStart(2, "0")}`,
    maxWeightKg: weight,
    avgReps: 8,
    volumeKg: weight * 8 * 3,
    setsDone: 3,
    setsTotal: 3,
    allDone: true,
    rpe: "ok" as const,
  }));
}

describe("exercise-history", () => {
  it("hitsForExercise returns newest first with volume/load", () => {
    const sessions = [
      session("a", "2026-09-10", "supino-reto", [{ reps: 8, weightKg: 70 }]),
      session("b", "2026-09-17", "supino-reto", [{ reps: 8, weightKg: 72.5 }]),
    ];
    const hits = hitsForExercise("supino-reto", sessions);
    expect(hits).toHaveLength(2);
    expect(hits[0]!.date).toBe("2026-09-17");
    expect(hits[0]!.maxWeightKg).toBe(72.5);
    expect(hits[1]!.maxWeightKg).toBe(70);
  });

  it("detectPlateau true when 4 sessions flat load and no RPE fácil", () => {
    expect(detectPlateau(flatHits(4))).toBe(true);
  });

  it("detectPlateau false when load progresses", () => {
    const hits = flatHits(4);
    hits[0]!.maxWeightKg = 80; // newest progressed
    expect(detectPlateau(hits)).toBe(false);
  });

  it("detectPlateau false when any RPE fácil in window", () => {
    const hits = flatHits(4);
    hits[1]!.rpe = "facil";
    expect(detectPlateau(hits)).toBe(false);
  });

  it("trendFromHits detects up/flat", () => {
    expect(trendFromHits(flatHits(4))).toBe("flat");
    const up = flatHits(4);
    up[0]!.maxWeightKg = 80;
    expect(trendFromHits(up)).toBe("up");
  });

  it("summarizeExercise + listExercisesWithHistory", () => {
    const sessions = [
      session("a", "2026-09-01", "supino-reto", [{ reps: 8, weightKg: 60 }], "ok"),
      session("b", "2026-09-08", "supino-reto", [{ reps: 8, weightKg: 62.5 }], "ok"),
      session("c", "2026-09-15", "agachamento", [{ reps: 5, weightKg: 100 }], "dificil"),
    ];
    const sum = summarizeExercise("supino-reto", sessions);
    expect(sum.hits).toHaveLength(2);
    expect(sum.prWeightKg).toBe(62.5);
    const list = listExercisesWithHistory(sessions);
    expect(list.map((x) => x.exerciseId)).toContain("supino-reto");
    expect(list.map((x) => x.exerciseId)).toContain("agachamento");
  });
});

describe("progression + plateau", () => {
  it("suggestProgression includes lastPerformance and plateau reason", () => {
    const sessions = [1, 2, 3, 4].map((i) =>
      session(
        `s${i}`,
        `2026-09-${String(10 + i).padStart(2, "0")}`,
        "supino-reto",
        [
          { reps: 8, weightKg: 70 },
          { reps: 8, weightKg: 70 },
          { reps: 8, weightKg: 70 },
        ],
        "ok",
      ),
    );
    const result = suggestProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions,
      weekMode: "normal",
    });
    expect(result.plateau).toBe(true);
    expect(result.lastPerformance).toContain("70");
    expect(result.reason.toLowerCase()).toMatch(/plateau|última vez/);
  });

  it("suggestProgression bumps load after easy completed sets", () => {
    const sessions = [
      session(
        "s1",
        "2026-09-17",
        "supino-reto",
        [
          { reps: 10, weightKg: 70 },
          { reps: 10, weightKg: 70 },
          { reps: 10, weightKg: 70 },
        ],
        "facil",
      ),
    ];
    const result = suggestProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions,
      weekMode: "normal",
    });
    expect(result.plateau).toBe(false);
    expect(result.load).toBe(72.5);
    expect(result.lastPerformance).toContain("70");
  });
});

describe("exercise prefs in planner", () => {
  it("avoids disliked exercises when alternatives exist", () => {
    const { days } = buildWeeklyPlanDetailed(profile, [], undefined, null, {
      dislikedExerciseIds: ["supino-reto"],
    });
    const allIds = days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(allIds.includes("supino-reto")).toBe(false);
  });

  it("favors liked exercises in selection", () => {
    const { days } = buildWeeklyPlanDetailed(profile, [], undefined, null, {
      likedExerciseIds: ["crucifixo"],
    });
    const pushDay = days.find((d) => d.title.includes("Empurrar"));
    expect(pushDay).toBeTruthy();
    expect(pushDay!.exercises.some((e) => e.exerciseId === "crucifixo")).toBe(true);
  });
});

describe("recovery volume decay", () => {
  it("higher last volume slows freshness recovery", () => {
    const light = [
      session("a", new Date().toISOString().slice(0, 10), "supino-reto", [
        { reps: 5, weightKg: 40 },
      ]),
    ];
    const heavy = [
      session("b", new Date().toISOString().slice(0, 10), "supino-reto", [
        { reps: 10, weightKg: 100 },
        { reps: 10, weightKg: 100 },
        { reps: 10, weightKg: 100 },
        { reps: 10, weightKg: 100 },
      ]),
    ];
    // Force same "now" slightly after session date noon
    const now = new Date();
    now.setHours(now.getHours() + 12);
    const lightMap = muscleRecoveryMap(light, now);
    const heavyMap = muscleRecoveryMap(heavy, now);
    const lightPeito = lightMap.find((m) => m.group === "peito")!;
    const heavyPeito = heavyMap.find((m) => m.group === "peito")!;
    expect(heavyPeito.lastVolume!).toBeGreaterThan(lightPeito.lastVolume!);
    expect(heavyPeito.freshness).toBeLessThanOrEqual(lightPeito.freshness);
  });
});

describe("emptyState prefs", () => {
  it("includes liked/disliked arrays", () => {
    expect(emptyState.likedExerciseIds).toEqual([]);
    expect(emptyState.dislikedExerciseIds).toEqual([]);
  });
});
