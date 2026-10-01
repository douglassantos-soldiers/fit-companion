/**
 * Shared evidence pack for explainability.
 */
import type { CoachContext, CoachEvidencePack, CoachProposal } from "@/lib/coach/types";

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

/** Flatten CoachEvidencePack (+ optional scalars) into proposal evidence Record. */
export function toProposalEvidence(
  pack: CoachEvidencePack,
  extra?: Record<string, string | number | boolean | null>,
): CoachProposal["evidence"] {
  const out: CoachProposal["evidence"] = {};
  if (pack.sleepHours !== undefined) out.sleepHours = pack.sleepHours ?? null;
  if (pack.hardRpeStreak !== undefined) out.hardRpeStreak = pack.hardRpeStreak ?? null;
  if (pack.recoveryLevel !== undefined) out.recoveryLevel = pack.recoveryLevel ?? null;
  if (pack.trainingMode !== undefined) out.trainingMode = pack.trainingMode ?? null;
  if (pack.volumeFactor !== undefined) out.volumeFactor = pack.volumeFactor ?? null;
  if (pack.proteinG !== undefined) out.proteinG = pack.proteinG ?? null;
  if (pack.proteinTarget !== undefined) out.proteinTarget = pack.proteinTarget ?? null;
  if (pack.decisionSummary !== undefined) out.decisionSummary = pack.decisionSummary ?? null;
  if (pack.reasonCodes !== undefined) {
    out.reasonCodes = pack.reasonCodes.length ? pack.reasonCodes.join(",") : null;
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      out[key] = value;
    }
  }
  return out;
}
