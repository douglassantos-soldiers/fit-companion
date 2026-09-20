/**
 * PHASE 1 Deep Training Engine — 10 core scenarios.
 */
import { describe, expect, it } from "vitest";
import { estimated1RM, best1RM, exerciseStrengthTrend, oneRmFromHit } from "@/lib/training/one-rm";
import { detectExercisePrs, currentPersonalRecords } from "@/lib/training/prs";
import { analyzePlateau } from "@/lib/training/plateau";
import { decideProgression, PROGRESSION_CODE_LABEL, type ProgressionReasonCode, weekModifier } from "@/lib/training/progression";
import { computeMuscleLoad } from "@/lib/training/muscle-load";
import { buildWeeklyPlanDetailed } from "@/lib/training/plan";
import { toSetExecution, toLegacySetLog, enrichSetLog } from "@/lib/training/sets";
import { enrichSessionExercises } from "@/lib/training/session";
import { migrateLegacyPrefs, setPreference, prefsToLegacyArrays } from "@/lib/training/preferences";
import { normalizeExercise, catalogById } from "@/lib/training/exercise-catalog";
import { buildMuscleRecoverySnapshots, muscleRecoveryMap } from "@/lib/engine/recovery";
import { hitsForExercise } from "@/lib/engine/exercise-history";
import { exerciseById } from "@/data/exercises";
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
  sets: Array<{ reps: number; weightKg: number; done?: boolean; rpe?: number }>,
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
        sets: sets.map((s) => ({
          reps: s.reps,
          weightKg: s.weightKg,
          done: s.done ?? true,
          ...(s.rpe != null ? { rpe: s.rpe } : {}),
        })),
      },
    ],
    ...(rpe ? { rpe } : {}),
  };
}

describe("Deep Training — catalog & sets", () => {
  it("normalizes catalog with primary/secondary muscles", () => {
    const ex = exerciseById("supino-reto")!;
    const cat = normalizeExercise(ex);
    expect(cat.primaryMuscles).toEqual(["peito"]);
    expect(cat.secondaryMuscles).toContain("triceps");
    expect(catalogById("supino-reto")?.movementPattern).toBe("press");
  });

  it("set adapters preserve legacy fields", () => {
    const legacy = { reps: 8, weightKg: 70, done: true };
    const exec = toSetExecution(legacy, "supino-reto", 1);
    expect(exec.actualReps).toBe(8);
    expect(exec.type).toBe("working");
    const back = toLegacySetLog(exec);
    expect(back.reps).toBe(8);
    expect(back.done).toBe(true);
    const enriched = enrichSetLog(legacy, { setNumber: 2, targetReps: "8-10", targetWeight: 72.5 });
    expect(enriched.setNumber).toBe(2);
    expect(enrichSessionExercises([{ exerciseId: "x", sets: [legacy] }])[0]!.sets[0]!.type).toBe(
      "working",
    );
  });
});

describe("Deep Training — 10 scenarios", () => {
  it("1. first session uses base load", () => {
    const d = decideProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions: [],
      weekMode: "normal",
    });
    expect(d.load).toBe(50);
    expect(d.reasonCodes).toContain("BASE_LOAD");
    expect(d.lastPerformance).toBeNull();
  });

  it("2. second session keeps last load and may bump", () => {
    const sessions = [
      session("s1", "2026-09-10", "supino-reto", [
        { reps: 10, weightKg: 70 },
        { reps: 10, weightKg: 70 },
        { reps: 10, weightKg: 70 },
      ], "ok"),
    ];
    const d = decideProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions,
      weekMode: "normal",
    });
    expect(d.load).toBe(72.5);
    expect(d.lastPerformance).toContain("70");
  });

  it("3. progression ready after easy RPE", () => {
    const sessions = [
      session("s1", "2026-09-10", "supino-reto", [
        { reps: 10, weightKg: 70 },
        { reps: 10, weightKg: 70 },
      ], "facil"),
    ];
    const d = decideProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions,
      weekMode: "normal",
    });
    expect(d.reasonCodes).toContain("RPE_EASY_BUMP");
    expect(d.load).toBe(72.5);
  });

  it("4. hard RPE holds load", () => {
    const sessions = [
      session("s1", "2026-09-10", "supino-reto", [
        { reps: 8, weightKg: 80 },
        { reps: 8, weightKg: 80 },
      ], "dificil"),
    ];
    const d = decideProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions,
      weekMode: "normal",
    });
    expect(d.load).toBe(80);
    expect(d.reasonCodes).toContain("RPE_HARD_HOLD");
  });

  it("5. partial failure reduces volume", () => {
    const sessions = [
      session("s1", "2026-09-10", "supino-reto", [
        { reps: 8, weightKg: 75, done: true },
        { reps: 5, weightKg: 75, done: false },
      ], "ok"),
    ];
    const d = decideProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions,
      weekMode: "normal",
    });
    expect(d.reasonCodes).toContain("PARTIAL_FAILURE");
    expect(d.sets).toBeLessThan(4);
  });

  it("6. PR detection on weight increase", () => {
    const sessions = [
      session("a", "2026-09-01", "supino-reto", [{ reps: 8, weightKg: 60 }]),
      session("b", "2026-09-08", "supino-reto", [{ reps: 8, weightKg: 70 }]),
    ];
    const prs = detectExercisePrs("supino-reto", sessions);
    expect(prs.some((p) => p.prType === "WEIGHT_PR" && p.value === 70)).toBe(true);
    expect(currentPersonalRecords(sessions).length).toBeGreaterThan(0);
  });

  it("7. plateau after flat sessions", () => {
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
    const hits = hitsForExercise("supino-reto", sessions);
    const p = analyzePlateau(hits);
    expect(p.plateau).toBe(true);
    expect(p.suggested_action).toBeTruthy();
    const d = decideProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions,
      weekMode: "normal",
    });
    expect(d.plateau).toBe(true);
  });

  it("8. deload week reduces load", () => {
    const sessions = [
      session("s1", "2026-09-17", "supino-reto", [{ reps: 8, weightKg: 100 }], "ok"),
    ];
    expect(weekModifier([{ ...sessions[0]!, rpe: "dificil" }, { ...sessions[0]!, id: "s2", rpe: "dificil" }])).toBe(
      "deload",
    );
    const d = decideProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions,
      weekMode: "deload",
    });
    expect(d.reasonCodes).toContain("WEEK_DELOAD");
    expect(d.load).toBeLessThan(100);
  });

  it("9. preferred exercise favored in plan", () => {
    const { days } = buildWeeklyPlanDetailed(profile, [], undefined, null, {
      exercisePreferences: { crucifixo: "preferred" },
    });
    const push = days.find((d) => d.title.includes("Empurrar"));
    expect(push!.exercises.some((e) => e.exerciseId === "crucifixo")).toBe(true);
  });

  it("10. avoided exercise excluded when alternatives exist", () => {
    const { days } = buildWeeklyPlanDetailed(profile, [], undefined, null, {
      exercisePreferences: { "supino-reto": "avoided" },
    });
    const all = days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(all.includes("supino-reto")).toBe(false);
  });

  it("lote 1 library exercises are in the planner pool without growing the day", () => {
    expect(exerciseById("supino-declinado")?.swapGroup).toBe("peito-press");
    const { days } = buildWeeklyPlanDetailed(profile, []);
    for (const day of days) {
      expect(day.exercises.length).toBe(5);
      const pairIds = day.exercises.map((e) => e.supersetGroupId).filter(Boolean);
      expect(new Set(pairIds).size).toBeLessThanOrEqual(1);
      expect(pairIds.length === 0 || pairIds.length === 2).toBe(true);
    }
    const push = days.find((d) => d.title.includes("Empurrar"));
    expect(push).toBeTruthy();
  });
});

describe("progression labels", () => {
  it("covers every reason code", () => {
    const codes: ProgressionReasonCode[] = [
      "BASE_LOAD",
      "LAST_SESSION",
      "RPE_EASY_BUMP",
      "RPE_HARD_HOLD",
      "HARD_STREAK_DELOAD",
      "PARTIAL_FAILURE",
      "PLATEAU_HOLD",
      "PLATEAU_REP_VARIATION",
      "WEEK_DELOAD",
      "WEEK_PUSH",
      "BODYWEIGHT_PROGRESS",
      "PROGRESSION_READY",
    ];
    for (const code of codes) {
      expect(PROGRESSION_CODE_LABEL[code].length).toBeGreaterThan(3);
    }
  });
});

describe("1RM + muscle load + recovery + prefs", () => {
  it("Epley 1RM", () => {
    expect(estimated1RM(100, 1)).toBe(100);
    expect(estimated1RM(100, 5)).toBeCloseTo(116.7, 0);
    const hit = hitsForExercise("supino-reto", [
      session("s", "2026-09-10", "supino-reto", [{ reps: 5, weightKg: 100 }]),
    ])[0]!;
    expect(oneRmFromHit(hit)?.formula).toBe("epley");
    expect(best1RM([hit])?.value).toBeGreaterThan(100);
    expect(exerciseStrengthTrend([hit])).toBe("unknown");
  });

  it("muscle load and recovery snapshots", () => {
    const sessions = [
      session("s", new Date().toISOString().slice(0, 10), "supino-reto", [
        { reps: 10, weightKg: 80 },
        { reps: 10, weightKg: 80 },
        { reps: 10, weightKg: 80 },
      ]),
    ];
    const loads = computeMuscleLoad(sessions);
    const peito = loads.find((m) => m.muscle === "peito")!;
    expect(peito.direct_sets).toBeGreaterThan(0);
    const map = muscleRecoveryMap(sessions);
    expect(map.find((m) => m.group === "peito")).toBeTruthy();
    const snaps = buildMuscleRecoverySnapshots(sessions);
    expect(snaps.find((s) => s.muscle === "peito")?.freshness).toBeDefined();
  });

  it("preference migration", () => {
    const map = migrateLegacyPrefs({
      likedExerciseIds: ["a"],
      dislikedExerciseIds: ["b"],
      exercisePreferences: {},
    });
    expect(map["a"]).toBe("preferred");
    expect(map["b"]).toBe("disliked");
    const next = setPreference(map, "c", "avoided");
    expect(prefsToLegacyArrays(next).dislikedExerciseIds).toContain("c");
    expect(emptyState.exercisePreferences).toEqual({});
  });
});

describe("Training UX loop", () => {
  it("derives session RPE from working-set RPE", () => {
    const sessions = [
      session("s1", "2026-09-10", "supino-reto", [
        { reps: 8, weightKg: 80, rpe: 9 },
        { reps: 8, weightKg: 80, rpe: 9 },
      ]),
    ];
    delete sessions[0]!.rpe;
    const d = decideProgression({
      exerciseId: "supino-reto",
      fallbackLoad: 50,
      baseSets: 4,
      baseReps: "8-10",
      restSec: 90,
      goal: "massa",
      sessions,
      weekMode: "normal",
    });
    expect(d.load).toBe(80);
    expect(d.reasonCodes).toContain("RPE_HARD_HOLD");
  });

  it("respects custom training weekdays", () => {
    const plan = buildWeeklyPlanDetailed(
      { ...profile, trainingWeekdays: [2, 4, 6], daysPerWeek: 3 },
      [],
    );
    expect(plan.days.map((d) => d.weekday)).toEqual([2, 4, 6]);
  });

  it("adds warmup prescriptions for loaded compounds", () => {
    const plan = buildWeeklyPlanDetailed(profile, []);
    const loaded = plan.days.flatMap((d) => d.exercises).find((e) => e.unit === "kg" && e.suggestedLoad >= 20);
    expect(loaded?.prescriptions?.some((p) => p.type === "warmup")).toBe(true);
  });
});
