/**
 * Coach proposals — validated against Decision/Safety engines; never write critical tables.
 */
import type { DecisionBundle } from "@/lib/engine/decision";
import type { SafetyVerdict } from "@/lib/engine/safety";
import { actionsFromIds } from "@/lib/coach/actions";
import type { CoachAction, CoachProposal, CoachProposalType } from "@/lib/coach/types";

const TYPE_TO_ACTION: Record<CoachProposalType, CoachProposal["action"]> = {
  REDUCE_VOLUME: "adapt_workout",
  INCREASE_RECOVERY: "recommend_rest",
  REST: "recommend_rest",
  EXPRESS_WORKOUT: "adapt_workout",
  FULL_WORKOUT: "open_training",
  DELOAD: "adapt_workout",
  NUTRITION_FOCUS: "recommend_meal",
  HYDRATION_FOCUS: "recommend_hydration",
  SLEEP_FOCUS: "recommend_sleep",
  CHECKIN: "start_checkin",
};

export function makeProposal(
  type: CoachProposalType,
  value: string | number | boolean,
  reasonCodes: string[],
  evidence: CoachProposal["evidence"],
  confidence: number,
): CoachProposal {
  return {
    type,
    action: TYPE_TO_ACTION[type],
    value,
    reasonCodes: [...new Set(reasonCodes)].slice(0, 8),
    evidence,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

/**
 * Align proposal with live Decision/Safety. Reject or downgrade if conflicting.
 */
export function validateProposalAgainstDecisionEngine(
  proposal: CoachProposal,
  decisions: DecisionBundle | null,
  safety: SafetyVerdict,
): { ok: boolean; proposal: CoachProposal | null; reason: string } {
  if (safety.escalateCare) {
    const rest = makeProposal(
      "REST",
      true,
      ["escalate_care", ...proposal.reasonCodes],
      { ...proposal.evidence, escalateCare: true },
      Math.min(proposal.confidence, 0.95),
    );
    return { ok: true, proposal: rest, reason: "forced_rest_on_escalate" };
  }

  if (!decisions) {
    return { ok: true, proposal, reason: "no_live_decisions" };
  }

  const mode = decisions.trainingMode;
  if (proposal.type === "FULL_WORKOUT" && (mode === "rest" || mode === "deload")) {
    return {
      ok: false,
      proposal: null,
      reason: `conflicts_with_training_mode=${mode}`,
    };
  }
  if (proposal.type === "REDUCE_VOLUME" && decisions.trainingVolume >= 0.95) {
    // Still allow but lower confidence
    return {
      ok: true,
      proposal: { ...proposal, confidence: Math.min(proposal.confidence, 0.55) },
      reason: "volume_already_high_downgraded",
    };
  }
  if (proposal.type === "REST" && mode === "full" && !safety.preferLightTraining) {
    return {
      ok: true,
      proposal: { ...proposal, confidence: Math.min(proposal.confidence, 0.5) },
      reason: "rest_vs_full_downgraded",
    };
  }

  return { ok: true, proposal, reason: "aligned" };
}

export function actionsForProposal(proposal: CoachProposal | null): CoachAction[] {
  if (!proposal) return [];
  return actionsFromIds([proposal.action]);
}

/** Map living-plan primary action / mode to a coach proposal. */
export function proposalFromDecisions(
  decisions: DecisionBundle,
  safety: SafetyVerdict,
  evidence: CoachProposal["evidence"],
): CoachProposal {
  if (safety.escalateCare || decisions.trainingMode === "rest") {
    return makeProposal("REST", true, ["recovery_low"], evidence, 0.85);
  }
  if (decisions.trainingMode === "deload") {
    return makeProposal("DELOAD", decisions.trainingVolume, ["deload_week"], evidence, 0.8);
  }
  if (decisions.trainingMode === "express" || decisions.trainingVolume < 0.85) {
    return makeProposal(
      decisions.trainingMode === "express" ? "EXPRESS_WORKOUT" : "REDUCE_VOLUME",
      decisions.trainingVolume,
      ["time_limited"],
      evidence,
      0.75,
    );
  }
  if (decisions.primaryAction === "meal") {
    return makeProposal("NUTRITION_FOCUS", true, ["protein_low"], evidence, 0.7);
  }
  if (decisions.primaryAction === "sleep") {
    return makeProposal("SLEEP_FOCUS", true, ["sleep_low"], evidence, 0.75);
  }
  return makeProposal("FULL_WORKOUT", decisions.trainingVolume, [], evidence, 0.7);
}
