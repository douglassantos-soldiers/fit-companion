/**
 * LearningEvent builders — signals that may update future priors.
 * Learning never overrides Safety or Decision authority.
 */
import type { LearningDecisionRef } from "@/lib/engine/learning/decision-ref";
import type { LearningOutcome } from "@/lib/engine/learning/outcome";
import { LEARNING_CONTRACT_VERSION, LEARNING_ENGINE_VERSION } from "@/lib/engine/learning/version";

export type LearningEventKind =
  | "pattern_detected"
  | "pattern_reinforced"
  | "pattern_weakened"
  | "intervention_response"
  | "experiment_settled"
  | "attribution_recorded"
  | "bias_blocked";

export type LearningEventDomain =
  "training" | "nutrition" | "recovery" | "behavior" | "sleep" | "general";

export type LearningEvent = {
  event_id: string;
  user_id: string;
  kind: LearningEventKind;
  created_at: string;
  decision_id?: string;
  outcome_id?: string;
  run_id?: string;
  confidence: number;
  pattern_key?: string;
  domain?: LearningEventDomain;
  evidence: Record<string, number | string | boolean | null>;
  notes?: string[];
  /** When true, event was recorded but must not bias decisions. */
  blocked_by_guardrail?: boolean;
  engine_version: string;
  contract_version: number;
};

/** Alias kept for call sites that used EngineLearningEvent. */
export type EngineLearningEvent = LearningEvent;

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) + h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

export function buildLearningEventId(parts: string[]): string {
  return `le_${djb2(parts.join("|"))}`;
}

export function buildLearningEvent(opts: {
  kind: LearningEventKind;
  decision: LearningDecisionRef;
  outcome?: LearningOutcome | null;
  confidence: number;
  patternKey?: string;
  domain?: LearningEventDomain;
  evidence?: Record<string, number | string | boolean | null>;
  notes?: string[];
  blockedByGuardrail?: boolean;
  createdAt?: string;
}): LearningEvent {
  const created_at = opts.createdAt ?? opts.outcome?.createdAt ?? new Date().toISOString();
  const evidence: Record<string, number | string | boolean | null> = {
    decision_type: opts.decision.decisionType,
    decision_confidence: opts.decision.confidence,
    ...(opts.outcome
      ? {
          action: opts.outcome.action,
          adherence: opts.outcome.adherence,
          result: opts.outcome.result,
          quality: opts.outcome.quality,
          measured_value:
            opts.outcome.measuredValue === null || opts.outcome.measuredValue === undefined
              ? null
              : typeof opts.outcome.measuredValue === "boolean"
                ? opts.outcome.measuredValue
                : opts.outcome.measuredValue,
          expected_value:
            opts.outcome.expectedValue === null || opts.outcome.expectedValue === undefined
              ? null
              : typeof opts.outcome.expectedValue === "boolean"
                ? opts.outcome.expectedValue
                : opts.outcome.expectedValue,
        }
      : { result: "missing" }),
    ...opts.evidence,
  };

  const event: LearningEvent = {
    event_id: buildLearningEventId([
      opts.kind,
      opts.decision.decisionId,
      opts.outcome?.outcomeId ?? "none",
      created_at,
      String(opts.confidence),
    ]),
    user_id: opts.decision.userId,
    kind: opts.kind,
    created_at,
    decision_id: opts.decision.decisionId,
    confidence: Math.max(0, Math.min(1, opts.confidence)),
    evidence,
    engine_version: LEARNING_ENGINE_VERSION,
    contract_version: LEARNING_CONTRACT_VERSION,
  };

  if (opts.outcome?.outcomeId) event.outcome_id = opts.outcome.outcomeId;
  if (opts.patternKey) event.pattern_key = opts.patternKey;
  if (opts.domain) event.domain = opts.domain;
  if (opts.notes?.length) event.notes = opts.notes;
  if (opts.blockedByGuardrail) event.blocked_by_guardrail = true;

  return event;
}
