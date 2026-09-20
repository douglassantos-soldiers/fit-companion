/**
 * Structured progression decisions for Deep Training Engine.
 * engine/progression.ts re-exports a compatibility facade.
 */
import { exerciseById, type Exercise } from "@/data/exercises";
import { formatLastPerformance, hitsForExercise } from "@/lib/engine/exercise-history";
import { analyzePlateau } from "@/lib/training/plateau";
import { estimated1RM, oneRmFromHit } from "@/lib/training/one-rm";
import type { Goal, SessionLog, SessionRpe } from "@/lib/types";

export type WeekMode = "normal" | "deload" | "push";

export type ProgressionReasonCode =
  | "BASE_LOAD"
  | "LAST_SESSION"
  | "RPE_EASY_BUMP"
  | "RPE_HARD_HOLD"
  | "HARD_STREAK_DELOAD"
  | "PARTIAL_FAILURE"
  | "PLATEAU_HOLD"
  | "PLATEAU_REP_VARIATION"
  | "WEEK_DELOAD"
  | "WEEK_PUSH"
  | "BODYWEIGHT_PROGRESS"
  | "PROGRESSION_READY";

export interface ProgressionEvidence {
  lastLoad?: number;
  lastReps?: number;
  lastRpe?: SessionRpe;
  estimated1rm?: number;
  plateau?: boolean;
}

export interface ProgressionDecision {
  load: number;
  sets: number;
  reps: string;
  restSec: number;
  confidence: number;
  reasonCodes: ProgressionReasonCode[];
  evidence: ProgressionEvidence;
  lastPerformance: string | null;
  plateau: boolean;
  /** Human-readable for UI/compat */
  reason: string;
}

export interface ProgressionInput {
  exerciseId: string;
  fallbackLoad: number;
  baseSets: number;
  baseReps: string;
  restSec: number;
  goal: Goal;
  sessions: SessionLog[];
  weekMode: WeekMode;
}

const GOAL_MIN_REPS: Record<Goal, number> = {
  massa: 8,
  gordura: 12,
  performance: 5,
  saude: 10,
};

export function roundLoad(kg: number) {
  if (kg <= 0) return 0;
  return Math.max(2.5, Math.round(kg / 2.5) * 2.5);
}

export function weekModifier(
  sessions: SessionLog[],
  days = 7,
  learningHint?: WeekMode | null,
): WeekMode {
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  const recent = sessions.filter((s) => new Date(s.date) >= limit && s.rpe);
  const hard = recent.filter((s) => s.rpe === "dificil").length;
  const easy = recent.filter((s) => s.rpe === "facil").length;
  let fromRpe: WeekMode = "normal";
  if (hard >= 2) fromRpe = "deload";
  else if (easy >= 2 && hard === 0) fromRpe = "push";
  if (fromRpe !== "normal") return fromRpe;
  if (learningHint === "deload") return "deload";
  if (learningHint === "push") return "push";
  return "normal";
}

export const WEEK_MODE_LABEL: Record<WeekMode, string> = {
  normal: "Semana normal",
  deload: "Semana de deload",
  push: "Semana de push",
};

function parseRepTarget(reps: string) {
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  return nums[0] ?? 10;
}

function formatReps(min: number, goal: Goal) {
  if (goal === "performance") return String(Math.max(3, min));
  if (goal === "gordura") return `${min}-${min + 3}`;
  if (goal === "massa") return `${min}-${min + 2}`;
  return `${min}-${min + 2}`;
}

export const PROGRESSION_CODE_LABEL: Record<ProgressionReasonCode, string> = {
  BASE_LOAD: "Carga base do perfil",
  LAST_SESSION: "Mantém carga da última sessão",
  RPE_EASY_BUMP: "RPE fácil: +2,5 kg",
  RPE_HARD_HOLD: "RPE difícil: mantém carga",
  HARD_STREAK_DELOAD: "2 sessões difíceis: carga −10%",
  PARTIAL_FAILURE: "Falha parcial: mantém carga, reduz volume",
  PLATEAU_HOLD: "Plateau: mantém carga",
  PLATEAU_REP_VARIATION: "Plateau: varia reps/volume",
  WEEK_DELOAD: "deload (−15% carga, −1 série)",
  WEEK_PUSH: "push (+volume)",
  BODYWEIGHT_PROGRESS: "Progressão por reps",
  PROGRESSION_READY: "Séries completas: +2,5 kg",
};

export function decideProgression(input: ProgressionInput): ProgressionDecision {
  const ex = exerciseById(input.exerciseId);
  const unit = ex?.unit ?? "kg";
  const minReps = GOAL_MIN_REPS[input.goal];
  const hits = hitsForExercise(input.exerciseId, input.sessions);
  const lastHit = hits[0];
  const lastPerformance = formatLastPerformance(lastHit);
  const plateauInfo = analyzePlateau(hits);
  const plateau = plateauInfo.plateau;

  let load = input.fallbackLoad;
  let sets = input.baseSets;
  let reps = input.baseReps;
  const restSec = input.restSec;
  const codes: ProgressionReasonCode[] = [];
  const evidence: ProgressionEvidence = { plateau };

  if (lastHit) {
    evidence.lastLoad = lastHit.maxWeightKg;
    evidence.lastReps = lastHit.avgReps;
    if (lastHit.rpe) evidence.lastRpe = lastHit.rpe;
    const orm = oneRmFromHit(lastHit);
    if (orm) evidence.estimated1rm = orm.value;
  }

  if (hits.length > 0 && lastHit) {
    const allDone = lastHit.allDone;
    const lastLoad = lastHit.maxWeightKg;
    const avgReps = lastHit.avgReps || parseRepTarget(input.baseReps);
    const rpe = lastHit.rpe;
    const hardStreak =
      hits.length >= 2 && hits.slice(0, 2).every((h) => h.rpe === "dificil");

    if (unit === "kg" && lastLoad > 0) {
      load = lastLoad;
      codes.push("LAST_SESSION");
      if (plateau) {
        const nextMin = Math.max(minReps - 2, parseRepTarget(input.baseReps) - 2);
        reps = formatReps(nextMin, input.goal);
        sets = Math.min(sets + 1, input.baseSets + 1);
        codes.push("PLATEAU_REP_VARIATION");
      } else if (hardStreak) {
        load = roundLoad(lastLoad * 0.9);
        codes.push("HARD_STREAK_DELOAD");
      } else if (!allDone) {
        sets = Math.max(2, input.baseSets - 1);
        const nextMin = Math.max(minReps - 1, parseRepTarget(input.baseReps) - 1);
        reps = formatReps(nextMin, input.goal);
        codes.push("PARTIAL_FAILURE");
      } else if (avgReps >= minReps && (rpe === "facil" || rpe === "ok" || !rpe)) {
        load = roundLoad(lastLoad + 2.5);
        codes.push(rpe === "facil" ? "RPE_EASY_BUMP" : "PROGRESSION_READY");
      } else if (rpe === "dificil") {
        codes.push("RPE_HARD_HOLD");
      }
    } else if (unit !== "kg") {
      const lastReps = Math.round(avgReps) || parseRepTarget(input.baseReps);
      if (plateau) {
        reps = formatReps(lastReps + 2, input.goal);
        codes.push("PLATEAU_REP_VARIATION");
      } else if (hardStreak) {
        reps = formatReps(Math.max(minReps - 2, lastReps - 2), input.goal);
        sets = Math.max(2, input.baseSets - 1);
        codes.push("HARD_STREAK_DELOAD");
      } else if (!allDone) {
        sets = Math.max(2, input.baseSets - 1);
        reps = formatReps(Math.max(minReps - 1, lastReps - 1), input.goal);
        codes.push("PARTIAL_FAILURE");
      } else if (rpe === "facil" || allDone) {
        reps = formatReps(lastReps + 1, input.goal);
        codes.push("BODYWEIGHT_PROGRESS");
      }
      load = 0;
    }
  } else {
    codes.push("BASE_LOAD");
  }

  if (input.weekMode === "deload") {
    if (unit === "kg" && load > 0) load = roundLoad(load * 0.85);
    sets = Math.max(2, sets - 1);
    codes.push("WEEK_DELOAD");
  } else if (input.weekMode === "push" && !plateau) {
    if (unit === "kg" && load > 0 && hits.length > 0) {
      sets = Math.min(sets + 1, input.baseSets + 1);
    } else if (unit === "kg" && load > 0) {
      load = roundLoad(load * 1.05);
    }
    codes.push("WEEK_PUSH");
  }

  if (unit === "min") {
    load = 0;
    sets = 1;
  }

  const finalLoad = unit === "kg" ? roundLoad(load) : 0;
  const reasonParts = codes.map((c) => PROGRESSION_CODE_LABEL[c]);
  let reason = reasonParts.join(" · ");
  if (lastPerformance && hits.length > 0) {
    const today =
      unit === "kg" && finalLoad > 0 ? `${finalLoad} kg × ${reps}` : `${sets}×${reps}`;
    reason = `Última vez ${lastPerformance} → hoje ${today} · ${reason}`;
  }

  let confidence = 0.5;
  if (hits.length >= 3) confidence = 0.75;
  if (hits.length >= 5) confidence = 0.85;
  if (plateau) confidence = Math.min(confidence, plateauInfo.confidence + 0.1);

  return {
    load: finalLoad,
    sets,
    reps,
    restSec,
    confidence,
    reasonCodes: codes,
    evidence,
    lastPerformance,
    plateau,
    reason,
  };
}

/** Compat: same shape as legacy ProgressionResult + decision fields. */
export function suggestProgression(input: ProgressionInput) {
  const d = decideProgression(input);
  return {
    load: d.load,
    sets: d.sets,
    reps: d.reps,
    restSec: d.restSec,
    reason: d.reason,
    lastPerformance: d.lastPerformance,
    plateau: d.plateau,
    confidence: d.confidence,
    reasonCodes: d.reasonCodes,
    evidence: d.evidence,
  };
}

export function progressionForExercise(
  ex: Exercise,
  fallbackLoad: number,
  baseSets: number,
  baseReps: string,
  restSec: number,
  goal: Goal,
  sessions: SessionLog[],
  weekMode: WeekMode,
) {
  return suggestProgression({
    exerciseId: ex.id,
    fallbackLoad,
    baseSets,
    baseReps,
    restSec,
    goal,
    sessions,
    weekMode,
  });
}

export { estimated1RM };
