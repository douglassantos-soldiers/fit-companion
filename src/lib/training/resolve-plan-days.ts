/**
 * Resolve the week's PlannedDays: active block > sticky routine > generated plan.
 */
import { buildWeeklyPlan } from "@/lib/engine/plan";
import { learningWeekHint } from "@/lib/engine/learning";
import {
  isStickyPlanActive,
  plannedDaysFromSaved,
} from "@/lib/training/saved-training-plans";
import { buildWeeklyPlanFromBlock } from "@/lib/training/training-block";
import type { PlannedDay } from "@/lib/training/plan";
import type { AppState } from "@/lib/types";
import { todayKey } from "@/lib/types";

export function hasPrescribedPlan(state: AppState, date = todayKey()): boolean {
  if (state.activeTrainingBlock) return true;
  return Boolean(isStickyPlanActive(state, new Date(`${date}T12:00:00`)));
}

/** Stable seed for decision fingerprint when plan source changes (enroll / sticky). */
export function planSourceFingerprint(state: AppState, date = todayKey()): string {
  if (state.activeTrainingBlock && state.profile) {
    const days = buildWeeklyPlanFromBlock(state.activeTrainingBlock, state.profile, date);
    return `block:${state.activeTrainingBlock.id}:${days.map((d) => d.id).join(",")}`;
  }
  const sticky = isStickyPlanActive(state, new Date(`${date}T12:00:00`));
  if (sticky) {
    return `sticky:${sticky.id}:${state.activeTrainingPlanWeekKey ?? ""}:${sticky.days.map((d) => d.id).join(",")}`;
  }
  return "generated";
}

export function resolveTrainingPlanDays(
  state: AppState,
  date = todayKey(),
): PlannedDay[] {
  const profile = state.profile;
  if (!profile) return [];

  if (state.activeTrainingBlock) {
    return buildWeeklyPlanFromBlock(state.activeTrainingBlock, profile, date);
  }

  const sticky = isStickyPlanActive(state, new Date(`${date}T12:00:00`));
  if (sticky) return plannedDaysFromSaved(sticky.days);

  return buildWeeklyPlan(profile, state.sessions, learningWeekHint(state, date), {
    likedExerciseIds: state.likedExerciseIds ?? [],
    dislikedExerciseIds: state.dislikedExerciseIds ?? [],
    exercisePreferences: state.exercisePreferences,
  });
}
