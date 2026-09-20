/**
 * Facade — Deep Training progression lives in src/lib/training/progression.ts
 */
export {
  WEEK_MODE_LABEL,
  PROGRESSION_CODE_LABEL,
  decideProgression,
  progressionForExercise,
  roundLoad,
  suggestProgression,
  weekModifier,
  type ProgressionDecision,
  type ProgressionEvidence,
  type ProgressionInput,
  type ProgressionReasonCode,
  type WeekMode,
} from "@/lib/training/progression";

/** Legacy ProgressionResult = suggestProgression return shape */
export type ProgressionResult = ReturnType<typeof import("@/lib/training/progression").suggestProgression>;
