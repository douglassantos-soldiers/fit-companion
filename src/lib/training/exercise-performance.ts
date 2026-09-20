/**
 * Exercise performance derived from session logs (client aggregate; server recompute is SoT).
 */
import { hitsForExercise, listExercisesWithHistory, type ExerciseTrend } from "@/lib/engine/exercise-history";
import { best1RM, oneRmFromHit } from "@/lib/training/one-rm";
import type { SessionLog, SessionRpe } from "@/lib/types";

export interface ExercisePerformance {
  exerciseId: string;
  bestWeight: number;
  bestReps: number;
  bestVolume: number;
  estimated1rm: number;
  recentWeight: number;
  recentReps: number;
  recentRpe: SessionRpe | null;
  trend: ExerciseTrend;
  lastPerformedAt: string | null;
  updatedAt: string;
}

export function computeExercisePerformance(
  exerciseId: string,
  sessions: SessionLog[],
  now = new Date(),
): ExercisePerformance | null {
  const hits = hitsForExercise(exerciseId, sessions);
  if (!hits.length) return null;
  const recent = hits[0]!;
  let bestWeight = 0;
  let bestReps = 0;
  let bestVolume = 0;
  for (const h of hits) {
    if (h.maxWeightKg > bestWeight) {
      bestWeight = h.maxWeightKg;
      bestReps = Math.round(h.avgReps);
    }
    if (h.volumeKg > bestVolume) bestVolume = h.volumeKg;
  }
  const orm = best1RM(hits);
  const summaryTrend = listExercisesWithHistory(sessions, 100).find((s) => s.exerciseId === exerciseId)
    ?.trend;
  return {
    exerciseId,
    bestWeight,
    bestReps,
    bestVolume,
    estimated1rm: orm?.value ?? oneRmFromHit(recent)?.value ?? 0,
    recentWeight: recent.maxWeightKg,
    recentReps: recent.avgReps,
    recentRpe: recent.rpe ?? null,
    trend: summaryTrend ?? "unknown",
    lastPerformedAt: recent.date,
    updatedAt: now.toISOString(),
  };
}

export function computeAllExercisePerformances(sessions: SessionLog[]): ExercisePerformance[] {
  return listExercisesWithHistory(sessions, 100)
    .map((s) => computeExercisePerformance(s.exerciseId, sessions))
    .filter((p): p is ExercisePerformance => Boolean(p));
}
