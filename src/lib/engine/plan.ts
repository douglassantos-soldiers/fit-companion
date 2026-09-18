import {
  EXERCISES,
  matchesEquipment,
  normalizeRestrictions,
  respectsJoints,
  type Exercise,
  type MuscleGroup,
} from "@/data/exercises";
import { freshnessForGroups, sortGroupsByFreshness } from "@/lib/engine/recovery";
import {
  progressionForExercise,
  roundLoad,
  weekModifier,
  type WeekMode,
} from "@/lib/engine/progression";
import type { Goal, Level, Profile, SessionLog } from "@/lib/types";

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  suggestedLoad: number;
  unit: Exercise["unit"];
  reason?: string;
  recoveryOk?: boolean;
}

export interface PlannedDay {
  id: string;
  weekday: number;
  title: string;
  focus: string;
  estimatedMin: number;
  exercises: PlannedExercise[];
  recoveryScore?: number;
}

export interface WeeklyPlanResult {
  days: PlannedDay[];
  weekMode: WeekMode;
}

const SPLITS: Record<number, Array<{ title: string; focus: string; groups: MuscleGroup[] }>> = {
  2: [
    { title: "Corpo inteiro A", focus: "Força geral", groups: ["pernas", "peito", "costas", "core"] },
    { title: "Corpo inteiro B", focus: "Força geral", groups: ["costas", "ombros", "pernas", "core"] },
  ],
  3: [
    { title: "Empurrar", focus: "Peito, ombros e tríceps", groups: ["peito", "ombros", "triceps"] },
    { title: "Puxar", focus: "Costas e bíceps", groups: ["costas", "biceps", "core"] },
    { title: "Pernas", focus: "Quadríceps, posterior e core", groups: ["pernas", "core"] },
  ],
  4: [
    { title: "Superior A", focus: "Peito e costas", groups: ["peito", "costas", "triceps"] },
    { title: "Inferior A", focus: "Pernas e core", groups: ["pernas", "core"] },
    { title: "Superior B", focus: "Ombros e braços", groups: ["ombros", "biceps", "triceps"] },
    { title: "Inferior B", focus: "Posterior e panturrilha", groups: ["pernas", "core"] },
  ],
  5: [
    { title: "Empurrar", focus: "Peito, ombros e tríceps", groups: ["peito", "ombros", "triceps"] },
    { title: "Puxar", focus: "Costas e bíceps", groups: ["costas", "biceps"] },
    { title: "Pernas", focus: "Força de membros inferiores", groups: ["pernas", "core"] },
    { title: "Superior", focus: "Volume de tronco", groups: ["peito", "costas", "ombros"] },
    { title: "Condicionamento", focus: "Cardio e core", groups: ["cardio", "core"] },
  ],
  6: [
    { title: "Empurrar A", focus: "Peito e tríceps", groups: ["peito", "triceps"] },
    { title: "Puxar A", focus: "Costas e bíceps", groups: ["costas", "biceps"] },
    { title: "Pernas A", focus: "Quadríceps", groups: ["pernas", "core"] },
    { title: "Empurrar B", focus: "Ombros e tríceps", groups: ["ombros", "triceps"] },
    { title: "Puxar B", focus: "Costas e core", groups: ["costas", "core"] },
    { title: "Pernas B", focus: "Posterior e condicionamento", groups: ["pernas", "cardio"] },
  ],
};

const WEEKDAY_MAP: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

const GOAL_SCHEME: Record<Goal, { sets: number; reps: string; restSec: number; loadFactor: number }> = {
  massa: { sets: 4, reps: "8-10", restSec: 90, loadFactor: 1 },
  gordura: { sets: 3, reps: "12-15", restSec: 45, loadFactor: 0.75 },
  performance: { sets: 5, reps: "5", restSec: 150, loadFactor: 1.15 },
  saude: { sets: 3, reps: "10-12", restSec: 60, loadFactor: 0.8 },
};

const LEVEL_FACTOR: Record<Level, number> = {
  iniciante: 0.6,
  intermediario: 1,
  avancado: 1.3,
};

function pickExercises(
  groups: MuscleGroup[],
  equipment: Profile["equipment"],
  restrictions: string[],
  count: number,
  sessions: SessionLog[],
) {
  const avoided = normalizeRestrictions(restrictions);
  const orderedGroups = sortGroupsByFreshness(groups, sessions);
  const available = EXERCISES.filter(
    (e) => matchesEquipment(e, equipment) && respectsJoints(e, avoided),
  ).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  const picked: Exercise[] = [];
  let round = 0;
  while (picked.length < count && round < 5) {
    for (const group of orderedGroups) {
      const candidate = available.find((e) => e.group === group && !picked.includes(e));
      if (candidate) picked.push(candidate);
      if (picked.length >= count) break;
    }
    // Fallback: any safe exercise not yet picked
    if (picked.length < count) {
      const any = available.find((e) => !picked.includes(e));
      if (any) picked.push(any);
      else break;
    }
    round += 1;
  }
  return picked;
}

/** Mantém assinatura antiga: retorna só os dias. */
export function buildWeeklyPlan(
  profile: Profile,
  sessions: SessionLog[] = [],
  learningHint?: WeekMode | null,
): PlannedDay[] {
  return buildWeeklyPlanDetailed(profile, sessions, undefined, learningHint).days;
}

export function buildWeeklyPlanDetailed(
  profile: Profile,
  sessions: SessionLog[] = [],
  equipmentOverride?: Profile["equipment"],
  learningHint?: WeekMode | null,
): WeeklyPlanResult {
  const days = Math.min(6, Math.max(2, profile.daysPerWeek));
  const split = SPLITS[days] ?? SPLITS[3]!;
  const weekdays = WEEKDAY_MAP[days] ?? WEEKDAY_MAP[3]!;
  const scheme = GOAL_SCHEME[profile.goal];
  const equipment = equipmentOverride ?? profile.equipment;
  const mode = weekModifier(sessions, 7, learningHint ?? null);

  const planned = split!.map((block, i) => {
    const recoveryScore = freshnessForGroups(block.groups, sessions);
    const recoveryOk = recoveryScore >= 35;
    const count = profile.goal === "performance" ? 4 : 5;
    // Volume reduzido se grupo principal ainda fatigado
    const volumeFactor = recoveryOk ? 1 : 0.75;

    const exercises = pickExercises(
      block.groups,
      equipment,
      profile.restrictions,
      count,
      sessions,
    ).map((ex) => {
      const base = ex.baseLoad * LEVEL_FACTOR[profile.level] * scheme.loadFactor;
      const baseSets = Math.max(2, Math.round((ex.group === "cardio" ? 1 : scheme.sets) * volumeFactor));
      const baseReps = ex.group === "cardio" ? "15 min" : ex.unit === "min" ? "45 s" : scheme.reps;
      const prog = progressionForExercise(
        ex,
        roundLoad(base),
        baseSets,
        baseReps,
        scheme.restSec,
        profile.goal,
        sessions,
        mode,
      );

      return {
        exerciseId: ex.id,
        name: ex.name,
        sets: ex.group === "cardio" || ex.unit === "min" ? 1 : prog.sets,
        reps: prog.reps,
        restSec: prog.restSec,
        suggestedLoad: prog.load,
        unit: ex.unit,
        reason: prog.reason,
        recoveryOk,
      } satisfies PlannedExercise;
    });

    return {
      id: `dia-${i + 1}`,
      weekday: weekdays![i] ?? 1,
      title: recoveryOk ? block.title : `${block.title} (leve)`,
      focus: recoveryOk ? block.focus : `${block.focus} · recuperação baixa`,
      estimatedMin: 20 + exercises.length * (scheme.restSec > 100 ? 9 : 7),
      exercises,
      recoveryScore,
    } satisfies PlannedDay;
  });

  return { days: planned, weekMode: mode };
}

export { roundLoad, weekModifier };
export type { WeekMode };

export function planDayForToday(plan: PlannedDay[], date = new Date()) {
  const weekday = date.getDay(); // JS: Sunday=0 … Saturday=6 (same as PlannedDay.weekday)
  // Exact match only — rest days must return null (never "next workout" fallback).
  return plan.find((d) => d.weekday === weekday) ?? null;
}

export function sessionVolume(exercises: SessionLog["exercises"]) {
  return exercises.reduce(
    (total, ex) =>
      total +
      ex.sets.reduce((sum, s) => (s.done ? sum + s.reps * (s.weightKg || bodyLoad(ex.exerciseId)) : sum), 0),
    0,
  );
}

function bodyLoad(exerciseId: string) {
  const ex = EXERCISES.find((e) => e.id === exerciseId);
  return ex && ex.unit !== "kg" ? 10 : 0;
}

/** Shortened day: keep first compounds, halve sets, ~8–12 min. */
export function buildExpressSession(day: PlannedDay): PlannedDay {
  const compounds = day.exercises.filter((e) => e.sets >= 3).slice(0, 4);
  const base = compounds.length ? compounds : day.exercises.slice(0, 3);
  const exercises = base.map((ex) => ({
    ...ex,
    sets: Math.max(1, Math.ceil(ex.sets * 0.5)),
    restSec: Math.min(ex.restSec, 60),
    reason: "Express · protege streak",
  }));
  return {
    ...day,
    id: `${day.id}-express`,
    title: `${day.title} · Express`,
    focus: `Express · ${day.focus}`,
    estimatedMin: Math.min(12, Math.max(8, 6 + exercises.length * 2)),
    exercises,
  };
}
