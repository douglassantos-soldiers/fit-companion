/**
 * Deep Training Domain — public API (selective to avoid duplicate exports)
 */
export {
  catalogById,
  listCatalog,
  normalizeExercise,
  type CatalogExercise,
  type MovementPattern,
} from "@/lib/training/exercise-catalog";
export {
  buildPrescriptions,
  enrichSetLog,
  toLegacySetLog,
  toSetExecution,
  type SetExecution,
  type SetPrescription,
} from "@/lib/training/sets";
export {
  enrichSessionExercises,
  exerciseLogToExecution,
  sessionLogToWorkout,
  workoutToSessionLog,
  type ExerciseExecution,
  type WorkoutSession,
} from "@/lib/training/session";
export {
  ONE_RM_FORMULA,
  best1RM,
  estimated1RM,
  exerciseStrengthTrend,
  formatOneRmChange,
  oneRmFromHit,
  type OneRmEvidence,
  type StrengthTrend,
} from "@/lib/training/one-rm";
export {
  currentPersonalRecords,
  detectExercisePrs,
  detectSessionVolumePrs,
  weightPersonalRecords,
  type PersonalRecord,
  type PrType,
} from "@/lib/training/prs";
export { analyzePlateau, plateauForExercise, type PlateauResult, type PlateauSuggestedAction } from "@/lib/training/plateau";
export {
  computeAllExercisePerformances,
  computeExercisePerformance,
  type ExercisePerformance,
} from "@/lib/training/exercise-performance";
export {
  isAvoided,
  isPreferred,
  migrateLegacyPrefs,
  prefsToLegacyArrays,
  setPreference,
  type ExercisePreferenceRecord,
  type ExercisePreferenceValue,
} from "@/lib/training/preferences";
export {
  INDIRECT_WEIGHT,
  computeMuscleLoad,
  muscleLoadByGroup,
  type MuscleLoadStats,
} from "@/lib/training/muscle-load";
export {
  WEEK_MODE_LABEL,
  PROGRESSION_CODE_LABEL,
  decideProgression,
  progressionForExercise,
  suggestProgression,
  type ProgressionDecision,
  type ProgressionInput,
  type ProgressionReasonCode,
  type WeekMode,
} from "@/lib/training/progression";
export {
  buildExpressSession,
  buildWeeklyPlan,
  buildWeeklyPlanDetailed,
  buildWeeklyPlanFromState,
  planDayForToday,
  sessionVolume,
  type ExercisePrefs,
  type PlannedDay,
  type PlannedExercise,
  type WeeklyPlanResult,
} from "@/lib/training/plan";
export { sessionHref, parseSessionHref } from "@/lib/training/session-nav";
export { sessionRpeFromSets, countableSets } from "@/lib/training/effort";
export { resolveTrainingWeekdays } from "@/lib/training/weekdays";
export { withWarmupPrescriptions } from "@/lib/training/warmup";
export { matchesInventory, equipmentFromInventory } from "@/lib/training/inventory";
export { trainingProofLine } from "@/lib/training/proof";
export {
  clearSupersetPair,
  maybePairSuperset,
  nextAfterSetComplete,
  partnerIndex,
} from "@/lib/training/superset";
