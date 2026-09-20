/**
 * Workout session / exercise execution models (distinct from prescription).
 */
import type { ExerciseLog, SessionLog, SessionRpe, SetLog } from "@/lib/types";
import { toLegacySetLog, toSetExecution, type SetExecution } from "@/lib/training/sets";

export interface ExerciseExecution {
  exerciseId: string;
  sets: SetExecution[];
}

export interface WorkoutSession {
  id: string;
  dayId: string;
  title: string;
  date: string;
  durationMin: number;
  exercises: ExerciseExecution[];
  volumeKg: number;
  rpe?: SessionRpe;
  express?: boolean;
}

export function exerciseLogToExecution(log: ExerciseLog): ExerciseExecution {
  return {
    exerciseId: log.exerciseId,
    sets: log.sets.map((s, i) => toSetExecution(s, log.exerciseId, i + 1)),
  };
}

export function executionToExerciseLog(exec: ExerciseExecution): ExerciseLog {
  return {
    exerciseId: exec.exerciseId,
    sets: exec.sets.map(toLegacySetLog),
  };
}

export function sessionLogToWorkout(session: SessionLog): WorkoutSession {
  return {
    id: session.id,
    dayId: session.dayId,
    title: session.title,
    date: session.date,
    durationMin: session.durationMin,
    exercises: session.exercises.map(exerciseLogToExecution),
    volumeKg: session.volumeKg,
    ...(session.rpe ? { rpe: session.rpe } : {}),
    ...(session.express != null ? { express: session.express } : {}),
  };
}

export function workoutToSessionLog(workout: WorkoutSession): SessionLog {
  return {
    id: workout.id,
    dayId: workout.dayId,
    title: workout.title,
    date: workout.date,
    durationMin: workout.durationMin,
    exercises: workout.exercises.map(executionToExerciseLog),
    volumeKg: workout.volumeKg,
    ...(workout.rpe ? { rpe: workout.rpe } : {}),
    ...(workout.express != null ? { express: workout.express } : {}),
  };
}

/** Ensure sets written on save carry rich defaults without breaking legacy readers. */
export function enrichSessionExercises(exercises: ExerciseLog[]): ExerciseLog[] {
  return exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    sets: ex.sets.map((s, i) => {
      const enriched: SetLog = {
        ...s,
        setNumber: s.setNumber ?? i + 1,
        type: s.type ?? "working",
        actualReps: s.actualReps ?? s.reps,
        actualWeight: s.actualWeight ?? s.weightKg,
        completed: s.completed ?? s.done,
      };
      return enriched;
    }),
  }));
}
