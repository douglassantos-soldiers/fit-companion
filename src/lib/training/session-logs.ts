import { parseRepTarget } from "@/lib/training/effort";
import type { PlannedExercise } from "@/lib/training/plan";
import type { ExerciseLog, SetLog } from "@/lib/types";

export function logsFromPlanned(exercises: PlannedExercise[]): ExerciseLog[] {
  return exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    ...(ex.supersetGroupId ? { supersetGroupId: ex.supersetGroupId } : {}),
    sets: setsFromPlanned(ex),
  }));
}

export function setsFromPlanned(ex: PlannedExercise): SetLog[] {
  if (ex.prescriptions?.length) {
    return ex.prescriptions.map((p) => ({
      reps: parseRepTarget(p.targetReps),
      weightKg: p.targetWeight,
      done: false,
      type: p.type,
      setNumber: p.setNumber,
      targetReps: p.targetReps,
      targetWeight: p.targetWeight,
      restSec: p.restSec,
    }));
  }
  return Array.from({ length: ex.sets }, (_, i) => ({
    reps: parseRepTarget(ex.reps),
    weightKg: ex.suggestedLoad,
    done: false,
    type: "working" as const,
    setNumber: i + 1,
    targetReps: ex.reps,
    targetWeight: ex.suggestedLoad,
    restSec: ex.restSec,
  }));
}

/**
 * Strong-style autofill: copy weight/reps from a completed set onto following
 * unfinished working sets (skips warmups).
 */
export function propagateSetToFollowing(
  sets: SetLog[],
  fromIndex: number,
  source?: Pick<SetLog, "weightKg" | "reps">,
): SetLog[] {
  const src = source ?? sets[fromIndex];
  if (!src || fromIndex < 0 || fromIndex >= sets.length) return sets;
  return sets.map((s, i) => {
    if (i <= fromIndex) return s;
    if (s.done || s.skipped) return s;
    if (s.type === "warmup") return s;
    return {
      ...s,
      weightKg: src.weightKg,
      reps: src.reps,
    };
  });
}

/** Build the next working set by copying the last set (or fallbacks). */
export function nextWorkingSetFromLast(
  sets: SetLog[],
  fallback: { reps: number; weightKg: number },
): SetLog {
  const last = sets[sets.length - 1];
  return {
    reps: last?.reps ?? fallback.reps,
    weightKg: last?.weightKg ?? fallback.weightKg,
    done: false,
    type: "working",
    setNumber: sets.length + 1,
  };
}
