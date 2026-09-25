/**
 * Projection of Decision fields consumed by the Learning cycle.
 * Learning never authors Decisions — Decision Engine remains SoT.
 */
import type { Decision, DecisionView } from "@/lib/engine/decision-contract";
import type { DecisionEvidence } from "@/lib/engine/decision-evidence";
import type { ReasonCode } from "@/lib/engine/reason-codes";

export type LearningDecisionRef = {
  decisionId: string;
  userId: string;
  contextId: string;
  decisionType: string;
  engineVersion: string;
  reasonCodes: ReasonCode[] | string[];
  evidence: DecisionEvidence | Record<string, unknown>;
  confidence: number;
  safetyStatus: {
    escalateCare: boolean;
    blockStims: boolean;
    preferLightTraining: boolean;
    flags: string[];
  };
  createdAt: string;
};

function isDecisionView(d: Decision | DecisionView | LearningDecisionRef): d is DecisionView {
  return "decisionId" in d && ("decisionVersion" in d || "why" in d);
}

function isDecision(d: Decision | DecisionView | LearningDecisionRef): d is Decision {
  return "decision_id" in d;
}

export function toLearningDecisionRef(
  d: Decision | DecisionView | LearningDecisionRef,
): LearningDecisionRef {
  if (isDecision(d)) {
    return {
      decisionId: d.decision_id,
      userId: d.user_id,
      contextId: d.context_id,
      decisionType: String(d.decision_type),
      engineVersion: d.engine_version,
      reasonCodes: d.reason_codes,
      evidence: d.evidence,
      confidence: d.confidence,
      safetyStatus: d.safety_status,
      createdAt: d.created_at,
    };
  }
  if (isDecisionView(d)) {
    return {
      decisionId: d.decisionId,
      userId: d.userId,
      contextId: d.contextId,
      decisionType: d.decisionType,
      engineVersion: d.engineVersion,
      reasonCodes: d.reasonCodes,
      evidence: d.evidence,
      confidence: d.confidence,
      safetyStatus: d.safetyStatus,
      createdAt: d.createdAt,
    };
  }
  return d;
}
