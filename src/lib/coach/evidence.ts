/**
 * Shared evidence pack for explainability.
 */
import type { CoachContext, CoachEvidencePack } from "@/lib/coach/types";

export function evidenceFromContext(ctx: CoachContext): CoachEvidencePack {
  const topDecision = ctx.todayDecisions[0];
  return {
    sleepHours: ctx.recovery.sleepHours,
    hardRpeStreak: ctx.recovery.hardRpeStreak,
    recoveryLevel: ctx.recovery.level,
    trainingMode: ctx.training.todayMode,
    volumeFactor: ctx.training.volumeFactor,
    proteinG: ctx.nutrition.proteinG,
    proteinTarget: ctx.nutrition.proteinTarget,
    decisionSummary: topDecision
      ? `${topDecision.type}=${topDecision.value} (conf ${topDecision.confidence})`
      : null,
    reasonCodes: ctx.reasonCodes.slice(0, 8),
  };
}
