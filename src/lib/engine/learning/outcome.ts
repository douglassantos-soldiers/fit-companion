/**
 * LearningOutcome — measured result of a Decision → Action cycle.
 * Feeds LearningEvent / LearningSignal; does not mutate Decision rules.
 */

export type LearningOutcomeResult = "positive" | "negative" | "mixed" | "unknown" | "missing";

export type LearningOutcomeQuality = "success" | "fail" | "mixed" | "unknown" | "pending";

export type LearningOutcome = {
  decisionId: string;
  action: string;
  adherence: number | null;
  result: LearningOutcomeResult;
  measuredValue: number | string | boolean | null;
  expectedValue: number | string | boolean | null;
  quality: LearningOutcomeQuality;
  createdAt: string;
  outcomeId?: string;
  userId?: string;
};

/** Minimal AI Outcome shape for bridging (avoids engine → ai import). */
export type AiOutcomeLike = {
  outcome_id: string;
  user_id: string;
  decision_id: string;
  created_at: string;
  window: "d0" | "d1" | "d3" | "d7" | "custom";
  quality: LearningOutcomeQuality;
  metrics: Record<string, number | string | boolean | null>;
};

function qualityToResult(quality: LearningOutcomeQuality): LearningOutcomeResult {
  switch (quality) {
    case "success":
      return "positive";
    case "fail":
      return "negative";
    case "mixed":
      return "mixed";
    case "pending":
      return "missing";
    default:
      return "unknown";
  }
}

function resultToQuality(result: LearningOutcomeResult): LearningOutcomeQuality {
  switch (result) {
    case "positive":
      return "success";
    case "negative":
      return "fail";
    case "mixed":
      return "mixed";
    case "missing":
      return "pending";
    default:
      return "unknown";
  }
}

/** Bridge AI Outcome contract → engine LearningOutcome. */
export function fromAiOutcome(o: AiOutcomeLike, action = "observed_action"): LearningOutcome {
  const adherenceRaw = o.metrics["adherence"];
  const adherence =
    typeof adherenceRaw === "number"
      ? Math.max(0, Math.min(1, adherenceRaw))
      : typeof adherenceRaw === "string" &&
          adherenceRaw !== "" &&
          !Number.isNaN(Number(adherenceRaw))
        ? Math.max(0, Math.min(1, Number(adherenceRaw)))
        : null;
  const measured = o.metrics["measuredValue"] ?? o.metrics["measured"] ?? null;
  const expected = o.metrics["expectedValue"] ?? o.metrics["expected"] ?? null;
  return {
    decisionId: o.decision_id,
    action,
    adherence,
    result: qualityToResult(o.quality),
    measuredValue: measured,
    expectedValue: expected,
    quality: o.quality,
    createdAt: o.created_at,
    outcomeId: o.outcome_id,
    userId: o.user_id,
  };
}

/** Bridge engine LearningOutcome → AI Outcome-like (minimal metrics). */
export function toAiOutcome(
  o: LearningOutcome,
  window: AiOutcomeLike["window"] = "d1",
): AiOutcomeLike {
  return {
    outcome_id: o.outcomeId ?? `out_${o.decisionId}_${o.createdAt}`,
    user_id: o.userId ?? "",
    decision_id: o.decisionId,
    created_at: o.createdAt,
    window,
    quality: o.quality ?? resultToQuality(o.result),
    metrics: {
      adherence: o.adherence,
      measuredValue: o.measuredValue,
      expectedValue: o.expectedValue,
      action: o.action,
      result: o.result,
    },
  };
}

export function normalizeAdherence(adherence: number | null | undefined): number | null {
  if (adherence == null || Number.isNaN(adherence)) return null;
  return Math.max(0, Math.min(1, adherence));
}

/** Partial adherence band used to attenuate confidence. */
export function isPartialAdherence(adherence: number | null): boolean {
  if (adherence == null) return false;
  return adherence >= 0.5 && adherence < 0.85;
}
