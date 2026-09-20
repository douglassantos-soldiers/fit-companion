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
