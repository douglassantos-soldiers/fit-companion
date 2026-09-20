/**
 * Muscle load engine — product heuristic (not clinical science).
 */
import type { MuscleGroup } from "@/data/exercises";
import { catalogById } from "@/lib/training/exercise-catalog";
import type { SessionLog } from "@/lib/types";

export interface MuscleLoadStats {
  muscle: MuscleGroup;
  direct_sets: number;
  indirect_sets: number;
  effective_sets: number;
  weekly_sets: number;
  rolling_7d: number;
  rolling_28d: number;
  load_trend: "up" | "flat" | "down" | "unknown";
  fatigue_contribution: number;
}

/** Indirect contribution weights by primary→secondary (heuristic). */
export const INDIRECT_WEIGHT = 0.5;
export const SECONDARY_DEFAULT_WEIGHT = 0.3;

function daysAgo(date: string, now: Date) {
  return (now.getTime() - new Date(date + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24);
}

function emptyStats(muscle: MuscleGroup): MuscleLoadStats {
  return {
    muscle,
    direct_sets: 0,
    indirect_sets: 0,
    effective_sets: 0,
    weekly_sets: 0,
    rolling_7d: 0,
    rolling_28d: 0,
    load_trend: "unknown",
    fatigue_contribution: 0,
  };
}

const ALL: MuscleGroup[] = [
  "peito",
  "costas",
  "pernas",
  "ombros",
  "biceps",
  "triceps",
  "core",
  "cardio",
];

export function computeMuscleLoad(
  sessions: SessionLog[],
  now = new Date(),
): MuscleLoadStats[] {
  const direct7 = new Map<MuscleGroup, number>();
  const indirect7 = new Map<MuscleGroup, number>();
  const direct28 = new Map<MuscleGroup, number>();
  const indirect28 = new Map<MuscleGroup, number>();
  const direct14 = new Map<MuscleGroup, number>();

  const bump = (map: Map<MuscleGroup, number>, m: MuscleGroup, v: number) => {
    map.set(m, (map.get(m) ?? 0) + v);
  };

  for (const session of sessions) {
    const age = daysAgo(session.date, now);
    if (age > 28) continue;
    for (const log of session.exercises) {
      const cat = catalogById(log.exerciseId);
      if (!cat) continue;
      const doneSets = log.sets.filter((s) => s.done || s.completed).length;
      if (!doneSets) continue;
      const primary = cat.primaryMuscles[0] ?? cat.group;
      if (age <= 28) bump(direct28, primary, doneSets);
      if (age <= 14) bump(direct14, primary, doneSets);
      if (age <= 7) bump(direct7, primary, doneSets);
      for (const sec of cat.secondaryMuscles) {
        const w = SECONDARY_DEFAULT_WEIGHT;
        if (age <= 28) bump(indirect28, sec, doneSets * w);
        if (age <= 7) bump(indirect7, sec, doneSets * w);
      }
    }
  }

  return ALL.map((muscle) => {
    const d7 = direct7.get(muscle) ?? 0;
    const i7 = indirect7.get(muscle) ?? 0;
    const d28 = direct28.get(muscle) ?? 0;
    const i28 = indirect28.get(muscle) ?? 0;
    const d14 = direct14.get(muscle) ?? 0;
    const effective7 = d7 + i7 * INDIRECT_WEIGHT;
    const effective28 = d28 + i28 * INDIRECT_WEIGHT;
    const firstHalf = d14;
    const secondHalf = Math.max(0, d28 - d14);
    let load_trend: MuscleLoadStats["load_trend"] = "unknown";
    if (d28 > 0) {
      if (firstHalf > secondHalf * 1.15) load_trend = "up";
      else if (secondHalf > firstHalf * 1.15) load_trend = "down";
      else load_trend = "flat";
    }
    return {
      muscle,
      direct_sets: Math.round(d7 * 10) / 10,
      indirect_sets: Math.round(i7 * 10) / 10,
      effective_sets: Math.round(effective7 * 10) / 10,
      weekly_sets: Math.round(effective7 * 10) / 10,
      rolling_7d: Math.round(effective7 * 10) / 10,
      rolling_28d: Math.round(effective28 * 10) / 10,
      load_trend,
      fatigue_contribution: Math.min(1, effective7 / 20),
    };
  });
}

export function muscleLoadByGroup(
  sessions: SessionLog[],
  now = new Date(),
): Map<MuscleGroup, MuscleLoadStats> {
  return new Map(computeMuscleLoad(sessions, now).map((s) => [s.muscle, s]));
}
