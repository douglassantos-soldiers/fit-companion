import { EXERCISES, exerciseById, type Exercise, type MuscleGroup } from "@/data/exercises";
import type { Goal, Level, Profile, SessionLog } from "@/lib/types";

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  suggestedLoad: number;
  unit: Exercise["unit"];
}

export interface PlannedDay {
  id: string;
  weekday: number; // 0 = domingo
  title: string;
  focus: string;
  estimatedMin: number;
  exercises: PlannedExercise[];
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

function pickExercises(groups: MuscleGroup[], equipment: Profile["equipment"], count: number) {
  const available = EXERCISES.filter(
    (e) => e.equipment === "ambos" || e.equipment === equipment,
  );
  const picked: Exercise[] = [];
  let round = 0;
  while (picked.length < count && round < 4) {
    for (const group of groups) {
      const candidate = available.find(
        (e) => e.group === group && !picked.includes(e),
      );
      if (candidate) picked.push(candidate);
      if (picked.length >= count) break;
    }
    round += 1;
  }
  return picked;
}

export function buildWeeklyPlan(profile: Profile, sessions: SessionLog[] = []): PlannedDay[] {
  const days = Math.min(6, Math.max(2, profile.daysPerWeek));
  const split = SPLITS[days] ?? SPLITS[3]!;
  const weekdays = WEEKDAY_MAP[days] ?? WEEKDAY_MAP[3]!;
  const scheme = GOAL_SCHEME[profile.goal];

  return split!.map((block, i) => {
    const count = profile.goal === "performance" ? 4 : 5;
    const exercises = pickExercises(block.groups, profile.equipment, count).map((ex) => {
      const base = ex.baseLoad * LEVEL_FACTOR[profile.level] * scheme.loadFactor;
      const suggested = suggestLoad(ex.id, roundLoad(base), sessions);
      return {
        exerciseId: ex.id,
        name: ex.name,
        sets: ex.group === "cardio" ? 1 : scheme.sets,
        reps: ex.group === "cardio" ? "15 min" : ex.unit === "min" ? "45 s" : scheme.reps,
        restSec: scheme.restSec,
        suggestedLoad: suggested,
        unit: ex.unit,
      } satisfies PlannedExercise;
    });

    return {
      id: `dia-${i + 1}`,
      weekday: weekdays[i],
      title: block.title,
      focus: block.focus,
      estimatedMin: 20 + exercises.length * (scheme.restSec > 100 ? 9 : 7),
      exercises,
    } satisfies PlannedDay;
  });
}

export function roundLoad(kg: number) {
  if (kg <= 0) return 0;
  return Math.max(2.5, Math.round(kg / 2.5) * 2.5);
}

/** Progressão simples: se na última sessão todas as séries foram concluídas, sobe a carga. */
export function suggestLoad(exerciseId: string, fallback: number, sessions: SessionLog[]) {
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const session of ordered) {
    const log = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!log || log.sets.length === 0) continue;
    const allDone = log.sets.every((s) => s.done);
    const last = Math.max(...log.sets.map((s) => s.weightKg));
    if (last <= 0) return fallback;
    return roundLoad(allDone ? last + 2.5 : last);
  }
  return fallback;
}

export function planDayForToday(plan: PlannedDay[], date = new Date()) {
  const weekday = date.getDay();
  return (
    plan.find((d) => d.weekday === weekday) ??
    plan.find((d) => d.weekday > weekday) ??
    null
  );
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
  const ex = exerciseById(exerciseId);
  return ex && ex.unit !== "kg" ? 10 : 0;
}
