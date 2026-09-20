import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import type { PlannedExercise } from "@/lib/training/plan";
import {
  clearSupersetPair,
  maybePairSuperset,
  nextAfterSetComplete,
} from "@/lib/training/superset";
import type { ExerciseLog } from "@/lib/types";

function pe(id: string): PlannedExercise {
  const ex = EXERCISES.find((e) => e.id === id)!;
  return {
    exerciseId: id,
    name: ex.name,
    sets: 3,
    reps: "8-10",
    restSec: 90,
    suggestedLoad: 40,
    unit: ex.unit,
  };
}

function log(id: string, done: number, total = 3, group?: string): ExerciseLog {
  return {
    exerciseId: id,
    ...(group ? { supersetGroupId: group } : {}),
    sets: Array.from({ length: total }, (_, i) => ({
      reps: 8,
      weightKg: 40,
      done: i < done,
    })),
  };
}

describe("maybePairSuperset", () => {
  it("pairs chest and back at most once", () => {
    const paired = maybePairSuperset([
      pe("supino-reto"),
      pe("crucifixo"),
      pe("remada-curvada"),
      pe("rosca-direta"),
    ]);
    const grouped = paired.filter((p) => p.supersetGroupId);
    expect(grouped).toHaveLength(2);
    expect(new Set(grouped.map((p) => p.supersetGroupId)).size).toBe(1);
    const ids = grouped.map((p) => p.exerciseId).sort();
    expect(ids).toEqual(["remada-curvada", "supino-reto"].sort());
  });

  it("pairs compound + isolation of the same family when no antagonist", () => {
    const paired = maybePairSuperset([pe("supino-reto"), pe("crucifixo"), pe("agachamento")]);
    const grouped = paired.filter((p) => p.supersetGroupId);
    expect(grouped.map((p) => p.exerciseId).sort()).toEqual(["crucifixo", "supino-reto"].sort());
  });
});

describe("nextAfterSetComplete", () => {
  it("skips rest when the partner still owes this round", () => {
    const planned = maybePairSuperset([pe("supino-reto"), pe("remada-curvada")]);
    const group = planned[0]!.supersetGroupId!;
    const logs = [log("supino-reto", 1, 3, group), log("remada-curvada", 0, 3, group)];
    const step = nextAfterSetComplete({ planned, logs, exIdx: 0, restSec: 90 });
    expect(step.openRest).toBe(false);
    expect(step.nextExIdx).toBe(1);
  });

  it("opens rest after both of the pair finished the round", () => {
    const planned = maybePairSuperset([pe("supino-reto"), pe("remada-curvada")]);
    const group = planned[0]!.supersetGroupId!;
    const logs = [log("supino-reto", 1, 3, group), log("remada-curvada", 1, 3, group)];
    const step = nextAfterSetComplete({ planned, logs, exIdx: 1, restSec: 90 });
    expect(step.openRest).toBe(true);
    expect(step.nextExIdx).toBe(0);
  });

  it("clears the pair on swap", () => {
    const paired = maybePairSuperset([pe("supino-reto"), pe("remada-curvada"), pe("agachamento")]);
    const idx = paired.findIndex((p) => p.exerciseId === "supino-reto");
    const cleared = clearSupersetPair(paired, idx);
    expect(cleared.every((p) => !p.supersetGroupId)).toBe(true);
  });
});
