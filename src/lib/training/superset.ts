import { EXERCISES, type MuscleGroup } from "@/data/exercises";
import type { ExerciseLog } from "@/lib/types";
import type { PlannedExercise } from "@/lib/training/plan";

const COMPLEMENT = new Map<MuscleGroup, MuscleGroup>([
  ["peito", "costas"],
  ["costas", "peito"],
  ["biceps", "triceps"],
  ["triceps", "biceps"],
]);

function meta(exerciseId: string) {
  const ex = EXERCISES.find((e) => e.id === exerciseId);
  return {
    group: ex?.group,
    swapGroup: ex?.swapGroup ?? "",
  };
}

function isCompound(swapGroup: string) {
  return /press|row|pull|squat|hinge/.test(swapGroup);
}

function isIsolation(swapGroup: string) {
  return /fly|curl|ext|raise|lunge/.test(swapGroup);
}

function family(swapGroup: string) {
  return swapGroup.split("-")[0] ?? swapGroup;
}

/**
 * At most one pair per day: antagonist groups, else compound + isolation of the same family.
 */
export function maybePairSuperset(exercises: PlannedExercise[]): PlannedExercise[] {
  if (exercises.length < 2) return exercises;
  const used = new Set<number>();

  const tryPair = (i: number, j: number, id: string) => {
    used.add(i);
    used.add(j);
    return exercises.map((ex, idx) =>
      idx === i || idx === j ? { ...ex, supersetGroupId: id } : ex,
    );
  };

  for (let i = 0; i < exercises.length; i += 1) {
    const a = meta(exercises[i]!.exerciseId);
    if (!a.group) continue;
    const want = COMPLEMENT.get(a.group);
    if (!want) continue;
    const j = exercises.findIndex((ex, idx) => idx !== i && meta(ex.exerciseId).group === want);
    if (j >= 0) {
      return tryPair(i, j, `ss-${a.group}-${want}`);
    }
  }

  for (let i = 0; i < exercises.length; i += 1) {
    const a = meta(exercises[i]!.exerciseId);
    if (!isCompound(a.swapGroup)) continue;
    const j = exercises.findIndex((ex, idx) => {
      if (idx === i) return false;
      const b = meta(ex.exerciseId);
      return isIsolation(b.swapGroup) && family(b.swapGroup) === family(a.swapGroup);
    });
    if (j >= 0) {
      return tryPair(i, j, `ss-${family(a.swapGroup)}`);
    }
  }

  return exercises;
}

export function partnerIndex(planned: PlannedExercise[], exIdx: number): number {
  const id = planned[exIdx]?.supersetGroupId;
  if (!id) return -1;
  return planned.findIndex((p, i) => i !== exIdx && p.supersetGroupId === id);
}

export function clearSupersetPair(
  planned: PlannedExercise[],
  exIdx: number,
): PlannedExercise[] {
  const groupId = planned[exIdx]?.supersetGroupId;
  if (!groupId) return planned;
  return planned.map((p) => {
    if (p.supersetGroupId !== groupId) return p;
    const { supersetGroupId: _omit, ...rest } = p;
    return rest;
  });
}

export function firstIncompleteIndex(logs: ExerciseLog[], fallback: number): number {
  const idx = logs.findIndex((l) => l.sets.some((s) => !s.done));
  return idx >= 0 ? idx : fallback;
}

export function nextAfterSetComplete(opts: {
  planned: PlannedExercise[];
  logs: ExerciseLog[];
  exIdx: number;
  restSec: number;
}): { nextExIdx: number; openRest: boolean; betweenExercises: boolean; allDone: boolean } {
  const { planned, logs, exIdx, restSec } = opts;
  const allDone = logs.every((l) => l.sets.every((s) => s.done));
  if (allDone) {
    return { nextExIdx: exIdx, openRest: false, betweenExercises: false, allDone: true };
  }

  const myDone = logs[exIdx]?.sets.filter((s) => s.done).length ?? 0;
  const partner = partnerIndex(planned, exIdx);

  if (partner >= 0) {
    const partnerDone = logs[partner]?.sets.filter((s) => s.done).length ?? 0;
    const partnerPending = logs[partner]?.sets.some((s) => !s.done) ?? false;
    if (partnerPending && partnerDone < myDone) {
      return { nextExIdx: partner, openRest: false, betweenExercises: false, allDone: false };
    }
  }

  const exerciseDone = logs[exIdx]?.sets.every((s) => s.done) ?? false;
  const nextExIdx = firstIncompleteIndex(logs, exIdx);
  const betweenExercises = exerciseDone && nextExIdx !== exIdx;
  return {
    nextExIdx,
    openRest: restSec > 0,
    betweenExercises,
    allDone: false,
  };
}
