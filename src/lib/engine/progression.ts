import { exerciseById, type Exercise } from "@/data/exercises";
import type { Goal, SessionLog, SessionRpe } from "@/lib/types";

export type WeekMode = "normal" | "deload" | "push";

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

export interface ProgressionResult {
  load: number;
  sets: number;
  reps: string;
  restSec: number;
  reason: string;
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

/**
 * RPE da janela recente define o modo; learningHint reforça só quando RPE fica "normal".
 * Ex.: deload por streak de RPE difícil fora da janela → força deload; push do learning → permite push.
 */
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

function lastLogsForExercise(exerciseId: string, sessions: SessionLog[]) {
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const hits: Array<{ session: SessionLog; log: SessionLog["exercises"][number] }> = [];
  for (const session of ordered) {
    const log = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (log && log.sets.length) hits.push({ session, log });
  }
  return hits;
}

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

export function suggestProgression(input: ProgressionInput): ProgressionResult {
  const ex = exerciseById(input.exerciseId);
  const unit = ex?.unit ?? "kg";
  const minReps = GOAL_MIN_REPS[input.goal];
  const hits = lastLogsForExercise(input.exerciseId, input.sessions);

  let load = input.fallbackLoad;
  let sets = input.baseSets;
  let reps = input.baseReps;
  let restSec = input.restSec;
  let reason = "Carga base do perfil";

  if (hits.length > 0) {
    const { session, log } = hits[0]!;
    const allDone = log.sets.every((s) => s.done);
    const doneSets = log.sets.filter((s) => s.done);
    const lastLoad = Math.max(...log.sets.map((s) => s.weightKg), 0);
    const avgReps =
      doneSets.length > 0
        ? doneSets.reduce((s, x) => s + x.reps, 0) / doneSets.length
        : parseRepTarget(input.baseReps);
    const rpe: SessionRpe | undefined = session.rpe;
    const hardStreak = hits.slice(0, 2).every((h) => h.session.rpe === "dificil");

    if (unit === "kg" && lastLoad > 0) {
      load = lastLoad;
      if (hardStreak) {
        load = roundLoad(lastLoad * 0.9);
        reason = "2 sessões difíceis: carga −10%";
      } else if (!allDone) {
        sets = Math.max(2, input.baseSets - 1);
        const nextMin = Math.max(minReps - 1, parseRepTarget(input.baseReps) - 1);
        reps = formatReps(nextMin, input.goal);
        reason = "Falha parcial: mantém carga, reduz volume";
      } else if (avgReps >= minReps && (rpe === "facil" || rpe === "ok" || !rpe)) {
        load = roundLoad(lastLoad + 2.5);
        reason = rpe === "facil" ? "RPE fácil: +2,5 kg" : "Séries completas: +2,5 kg";
      } else if (rpe === "dificil") {
        reason = "RPE difícil: mantém carga";
      } else {
        reason = "Mantém carga da última sessão";
      }
    } else if (unit !== "kg") {
      const lastReps = Math.round(avgReps) || parseRepTarget(input.baseReps);
      if (hardStreak) {
        reps = formatReps(Math.max(minReps - 2, lastReps - 2), input.goal);
        sets = Math.max(2, input.baseSets - 1);
        reason = "2 sessões difíceis: reduz reps/séries";
      } else if (!allDone) {
        sets = Math.max(2, input.baseSets - 1);
        reps = formatReps(Math.max(minReps - 1, lastReps - 1), input.goal);
        reason = "Falha parcial: reduz volume";
      } else if (rpe === "facil" || allDone) {
        reps = formatReps(lastReps + 1, input.goal);
        reason = "Progressão por reps";
      } else {
        reps = formatReps(lastReps, input.goal);
        reason = "Mantém reps da última sessão";
      }
      load = 0;
    }
  }

  if (input.weekMode === "deload") {
    if (unit === "kg" && load > 0) load = roundLoad(load * 0.85);
    sets = Math.max(2, sets - 1);
    reason = `${reason} · deload (−15% carga, −1 série)`;
  } else if (input.weekMode === "push") {
    if (unit === "kg" && load > 0 && hits.length > 0) {
      // push already got +2.5 from easy; bump sets slightly if not already reduced
      sets = Math.min(sets + 1, input.baseSets + 1);
    } else if (unit === "kg" && load > 0) {
      load = roundLoad(load * 1.05);
    }
    reason = `${reason} · push (+volume)`;
  }

  if (unit === "min") {
    load = 0;
    sets = 1;
  }

  return { load: unit === "kg" ? roundLoad(load) : 0, sets, reps, restSec, reason };
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
