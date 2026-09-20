/**
 * Facade — Deep Training plan lives in src/lib/training/plan.ts
 */
export {
  buildExpressSession,
  buildWeeklyPlan,
  buildWeeklyPlanDetailed,
  buildWeeklyPlanFromState,
  planDayForToday,
  roundLoad,
  sessionVolume,
  weekModifier,
  type ExercisePrefs,
  type PlannedDay,
  type PlannedExercise,
  type WeekMode,
  type WeeklyPlanResult,
} from "@/lib/training/plan";
