/**
 * Plateau detection — identifies patterns; Recommendation/Plan decide actions.
 */
import type { ExerciseHit } from "@/lib/engine/exercise-history";
import { detectPlateau as detectPlateauFlat, hitsForExercise } from "@/lib/engine/exercise-history";
import { exerciseStrengthTrend } from "@/lib/training/one-rm";
import type { SessionLog } from "@/lib/types";

export type PlateauSuggestedAction =
  | "change_exercise"
  | "change_rep_range"
  | "reduce_volume"
  | "deload"
  | "hold_load";

export interface PlateauResult {
  plateau: boolean;
  confidence: number;
  evidence: string[];
  suggested_action: PlateauSuggestedAction | null;
}

export function analyzePlateau(hits: ExerciseHit[], window = 4): PlateauResult {
  const evidence: string[] = [];
  if (hits.length < 3) {
    return { plateau: false, confidence: 0, evidence: ["insufficient_history"], suggested_action: null };
  }

  const flat = detectPlateauFlat(hits, window);
  const trend = exerciseStrengthTrend(hits, window);
  const slice = hits.slice(0, Math.min(window, 5));
  const hardCount = slice.filter((h) => h.rpe === "dificil").length;
  const failCount = slice.filter((h) => !h.allDone).length;

  if (flat) evidence.push("no_load_volume_progress");
  if (trend === "flat") evidence.push("1rm_stable");
  if (hardCount >= 2) evidence.push("rising_rpe");
  if (failCount >= 2) evidence.push("recurring_failures");

  const plateau = flat || (trend === "flat" && hardCount >= 2 && slice.length >= 3);
  if (!plateau) {
    return { plateau: false, confidence: 0.3, evidence, suggested_action: null };
  }

  let suggested: PlateauSuggestedAction = "hold_load";
  let confidence = 0.55;
  if (failCount >= 2) {
    suggested = "reduce_volume";
    confidence = 0.75;
  } else if (hardCount >= 3) {
    suggested = "deload";
    confidence = 0.8;
  } else if (flat && trend === "flat" && hardCount >= 1) {
    suggested = "change_rep_range";
    confidence = 0.7;
  } else if (flat && slice.length >= 4) {
    suggested = "change_exercise";
    confidence = 0.65;
  }

  return { plateau: true, confidence, evidence, suggested_action: suggested };
}

export function plateauForExercise(exerciseId: string, sessions: SessionLog[]): PlateauResult {
  return analyzePlateau(hitsForExercise(exerciseId, sessions));
}
