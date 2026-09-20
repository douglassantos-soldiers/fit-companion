/**
 * Adaptive Coach Platform (Phase 3)
 * Engines calculate; Coach explains. Conceptual refs: Coach Leo / openGym — no code copied.
 */
export * from "@/lib/coach/types";
export * from "@/lib/coach/classify";
export * from "@/lib/coach/actions";
export * from "@/lib/coach/proposals";
export * from "@/lib/coach/evidence";
export { formatCoachContextForPrompt, buildTypedCoachContextFromState } from "@/lib/coach/context.server";
export {
  runCoachTool,
  prefetchToolsForTurn,
  COACH_TOOL_NAMES,
  coachToolSchemas,
} from "@/lib/coach/tools";
export { callCoachProvider } from "@/lib/coach/provider";
export { morningCheckinWorkflow } from "@/lib/coach/workflows/morning-checkin";
export { postWorkoutWorkflow } from "@/lib/coach/workflows/post-workout";
export { weeklyReview, weeklyReviewWorkflow } from "@/lib/coach/workflows/weekly-review";
export { recoveryAdjustmentWorkflow } from "@/lib/coach/workflows/recovery-adjustment";
export { plateauAnalysisWorkflow } from "@/lib/coach/workflows/plateau-analysis";
export { nutritionReviewWorkflow } from "@/lib/coach/workflows/nutrition-review";
