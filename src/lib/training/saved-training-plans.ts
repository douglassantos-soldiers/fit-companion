/**
 * Saved training plans — fork of weekly/day plan (Hevy + Boostcamp light).
 * Persisted in AppState retention like savedMeals (cap 20).
 */
import type { PlannedDay, PlannedExercise } from "@/lib/training/plan";
import type { SavedTrainingPlan, SavedTrainingPlanDay, SavedTrainingPlanExercise } from "@/lib/types";
import { weekStartKey } from "@/lib/engine/xp";

export const SAVED_TRAINING_PLANS_CAP = 20;

export function snapshotExercise(ex: PlannedExercise): SavedTrainingPlanExercise {
  return {
    exerciseId: ex.exerciseId,
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    restSec: ex.restSec,
    suggestedLoad: ex.suggestedLoad,
    unit: ex.unit,
  };
}

export function snapshotDay(day: PlannedDay): SavedTrainingPlanDay {
  return {
    id: day.id,
    title: day.title,
    focus: day.focus,
    weekday: day.weekday,
    estimatedMin: day.estimatedMin,
    exercises: day.exercises.map(snapshotExercise),
  };
}

export function plannedDaysFromSaved(days: SavedTrainingPlanDay[]): PlannedDay[] {
  return days.map((d) => ({
    id: d.id,
    weekday: d.weekday ?? 1,
    title: d.title,
    focus: d.focus,
    estimatedMin: d.estimatedMin ?? 45,
    exercises: d.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      restSec: ex.restSec,
      suggestedLoad: ex.suggestedLoad,
      unit: ex.unit,
    })),
  }));
}

export function forkWeekPlan(
  days: PlannedDay[],
  name?: string,
  now = new Date(),
): SavedTrainingPlan {
  const iso = now.toISOString();
  const label =
    name ??
    `Semana · ${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: label,
    kind: "week",
    createdAt: iso,
    updatedAt: iso,
    days: days.map(snapshotDay),
  };
}

export function forkDayPlan(day: PlannedDay, name?: string, now = new Date()): SavedTrainingPlan {
  const iso = now.toISOString();
  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name ?? day.title,
    kind: "day",
    createdAt: iso,
    updatedAt: iso,
    days: [snapshotDay(day)],
  };
}

export function upsertSavedTrainingPlan(
  list: SavedTrainingPlan[],
  plan: SavedTrainingPlan,
): SavedTrainingPlan[] {
  const rest = list.filter((p) => p.id !== plan.id);
  return [plan, ...rest].slice(0, SAVED_TRAINING_PLANS_CAP);
}

export function removeSavedTrainingPlan(
  list: SavedTrainingPlan[],
  id: string,
): SavedTrainingPlan[] {
  return list.filter((p) => p.id !== id);
}

export function mergeSavedTrainingPlans(
  local?: SavedTrainingPlan[],
  remote?: SavedTrainingPlan[],
): SavedTrainingPlan[] {
  const byId = new Map<string, SavedTrainingPlan>();
  for (const p of [...(remote ?? []), ...(local ?? [])]) {
    const prev = byId.get(p.id);
    if (!prev || (p.updatedAt ?? p.createdAt) >= (prev.updatedAt ?? prev.createdAt)) {
      byId.set(p.id, p);
    }
  }
  return [...byId.values()]
    .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
    .slice(0, SAVED_TRAINING_PLANS_CAP);
}

export function isStickyPlanActive(
  state: {
    activeTrainingPlanId?: string | null;
    activeTrainingPlanWeekKey?: string | null;
    savedTrainingPlans?: SavedTrainingPlan[];
  },
  now = new Date(),
): SavedTrainingPlan | null {
  const id = state.activeTrainingPlanId;
  const weekKey = state.activeTrainingPlanWeekKey;
  if (!id || !weekKey) return null;
  if (weekKey !== weekStartKey(now)) return null;
  return (state.savedTrainingPlans ?? []).find((p) => p.id === id) ?? null;
}
