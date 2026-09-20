/**
 * Estimated 1RM — Epley formula (deterministic, no LLM).
 * 1RM = weight * (1 + reps/30)
 * Valid for reps 1–12 typically; for reps > 12 confidence drops.
 */
import type { ExerciseHit } from "@/lib/engine/exercise-history";

export const ONE_RM_FORMULA = "epley" as const;

export interface OneRmEvidence {
  formula: typeof ONE_RM_FORMULA;
  weight: number;
  reps: number;
  at: string;
  value: number;
}

export function estimated1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  const capped = Math.min(reps, 15);
  const value = weightKg * (1 + capped / 30);
  return Math.round(value * 10) / 10;
}

export function oneRmFromHit(hit: ExerciseHit): OneRmEvidence | null {
  if (hit.maxWeightKg <= 0 || hit.avgReps <= 0) return null;
  const reps = Math.max(1, Math.round(hit.avgReps));
  const value = estimated1RM(hit.maxWeightKg, reps);
  if (value <= 0) return null;
  return {
    formula: ONE_RM_FORMULA,
    weight: hit.maxWeightKg,
    reps,
    at: hit.date,
    value,
  };
}

export function best1RM(hits: ExerciseHit[]): OneRmEvidence | null {
  let best: OneRmEvidence | null = null;
  for (const hit of hits) {
    const ev = oneRmFromHit(hit);
    if (!ev) continue;
    if (!best || ev.value > best.value) best = ev;
  }
  return best;
}

export type StrengthTrend = "up" | "flat" | "down" | "unknown";

export function exerciseStrengthTrend(hits: ExerciseHit[], window = 4): StrengthTrend {
  const slice = hits.slice(0, window);
  if (slice.length < 2) return "unknown";
  const chron = [...slice].reverse();
  const first = oneRmFromHit(chron[0]!);
  const last = oneRmFromHit(chron[chron.length - 1]!);
  if (!first || !last) return "unknown";
  const delta = last.value - first.value;
  if (delta > 1.5) return "up";
  if (delta < -1.5) return "down";
  return "flat";
}

export function formatOneRmChange(prev: number, next: number): string {
  return `Seu 1RM estimado subiu de ${prev} para ${next} kg.`.replace(
    "subiu",
    next >= prev ? "subiu" : "foi de",
  );
}
