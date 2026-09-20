import { parseRepTarget } from "@/lib/training/effort";
import { roundLoad } from "@/lib/training/progression";
import type { ExerciseLog, SetLog } from "@/lib/types";

export interface LoadDropSuggestion {
  exerciseIndex: number;
  setIndex: number;
  fromKg: number;
  toKg: number;
  reason: "rir_drop" | "rpe_rise" | "reps_miss";
}

function isWorking(set: SetLog) {
  return (set.type ?? "working") !== "warmup" && !set.skipped;
}

function lastCompletedWorking(sets: SetLog[], beforeIndex: number): SetLog | null {
  for (let i = beforeIndex - 1; i >= 0; i -= 1) {
    const s = sets[i];
    if (s && isWorking(s) && (s.done || s.completed)) return s;
  }
  return null;
}

function nextWorkingIndex(sets: SetLog[], afterIndex: number): number {
  for (let i = afterIndex + 1; i < sets.length; i += 1) {
    const s = sets[i];
    if (s && isWorking(s) && !s.done && !s.skipped) return i;
  }
  return -1;
}

function detectDropReason(prev: SetLog, current: SetLog, targetReps?: string): LoadDropSuggestion["reason"] | null {
  if (typeof prev.rir === "number" && typeof current.rir === "number" && prev.rir - current.rir >= 2) {
    return "rir_drop";
  }
  if (typeof prev.rpe === "number" && typeof current.rpe === "number" && current.rpe - prev.rpe >= 2) {
    return "rpe_rise";
  }
  const target = targetReps ? parseRepTarget(targetReps) : current.targetReps ? parseRepTarget(String(current.targetReps)) : null;
  const loadSame = Math.abs((current.weightKg ?? 0) - (prev.weightKg ?? 0)) < 0.01;
  if (target != null && loadSame && current.reps <= target - 2) return "reps_miss";
  return null;
}

export function suggestLoadDrop(opts: {
  logs: ExerciseLog[];
  exerciseIndex: number;
  completedSetIndex: number;
  targetReps?: string;
  nextExerciseGroup?: string | null;
  currentGroup?: string | null;
}): LoadDropSuggestion | null {
  const log = opts.logs[opts.exerciseIndex];
  if (!log) return null;
  const current = log.sets[opts.completedSetIndex];
  if (!current || !isWorking(current)) return null;
  const prev = lastCompletedWorking(log.sets, opts.completedSetIndex);
  if (!prev) return null;

  const reason = detectDropReason(prev, current, opts.targetReps);
  if (!reason) return null;

  const fromKg = current.weightKg;
  const toKg = roundLoad(fromKg * 0.9);
  if (toKg >= fromKg || toKg <= 0) return null;

  const nextSet = nextWorkingIndex(log.sets, opts.completedSetIndex);
  if (nextSet >= 0) {
    return { exerciseIndex: opts.exerciseIndex, setIndex: nextSet, fromKg, toKg, reason };
  }

  if (opts.currentGroup && opts.nextExerciseGroup && opts.currentGroup === opts.nextExerciseGroup) {
    const nextEx = opts.logs[opts.exerciseIndex + 1];
    const nextIdx = nextEx ? nextWorkingIndex(nextEx.sets, -1) : -1;
    if (nextEx && nextIdx >= 0) {
      return { exerciseIndex: opts.exerciseIndex + 1, setIndex: nextIdx, fromKg, toKg, reason };
    }
  }

  return null;
}

export function applyLoadDrop(logs: ExerciseLog[], suggestion: LoadDropSuggestion): ExerciseLog[] {
  return logs.map((log, i) => {
    if (i !== suggestion.exerciseIndex) return log;
    return {
      ...log,
      sets: log.sets.map((s, j) => (j === suggestion.setIndex ? { ...s, weightKg: suggestion.toKg } : s)),
    };
  });
}
