/**
 * Explicit exercise preferences — never inferred from a single session.
 */
import type { AppState, ExercisePreferenceValue } from "@/lib/types";

export type { ExercisePreferenceValue };

export interface ExercisePreferenceRecord {
  exerciseId: string;
  preference: ExercisePreferenceValue;
  reason?: string;
  updatedAt: string;
}

/** Migrate legacy liked/disliked arrays into preference map. */
export function migrateLegacyPrefs(state: Pick<
  AppState,
  "likedExerciseIds" | "dislikedExerciseIds" | "exercisePreferences"
>): Record<string, ExercisePreferenceValue> {
  const map: Record<string, ExercisePreferenceValue> = {
    ...(state.exercisePreferences ?? {}),
  };
  for (const id of state.likedExerciseIds ?? []) {
    if (!map[id]) map[id] = "preferred";
  }
  for (const id of state.dislikedExerciseIds ?? []) {
    if (!map[id] || map[id] === "neutral") map[id] = "disliked";
  }
  return map;
}

export function setPreference(
  current: Record<string, ExercisePreferenceValue>,
  exerciseId: string,
  preference: ExercisePreferenceValue | "clear",
): Record<string, ExercisePreferenceValue> {
  const next = { ...current };
  if (preference === "clear" || preference === "neutral") {
    delete next[exerciseId];
  } else {
    next[exerciseId] = preference;
  }
  return next;
}

/** Sync legacy arrays from preference map for older planner callers. */
export function prefsToLegacyArrays(prefs: Record<string, ExercisePreferenceValue>): {
  likedExerciseIds: string[];
  dislikedExerciseIds: string[];
} {
  const likedExerciseIds: string[] = [];
  const dislikedExerciseIds: string[] = [];
  for (const [id, p] of Object.entries(prefs)) {
    if (p === "preferred") likedExerciseIds.push(id);
    if (p === "disliked" || p === "avoided") dislikedExerciseIds.push(id);
  }
  return { likedExerciseIds, dislikedExerciseIds };
}

export function plannerPrefsFromState(state: AppState): {
  likedExerciseIds: string[];
  dislikedExerciseIds: string[];
} {
  const map = migrateLegacyPrefs(state);
  return prefsToLegacyArrays(map);
}

export function isAvoided(prefs: Record<string, ExercisePreferenceValue>, exerciseId: string) {
  const p = prefs[exerciseId];
  return p === "disliked" || p === "avoided";
}

export function isPreferred(prefs: Record<string, ExercisePreferenceValue>, exerciseId: string) {
  return prefs[exerciseId] === "preferred";
}
