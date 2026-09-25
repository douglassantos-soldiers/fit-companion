/**
 * Coach Agent — errors.
 */

export const COACH_AGENT_ERROR = {
  ANONYMOUS_DENIED: "anonymous_denied",
  INVALID_TRUSTED_USER: "invalid_trusted_user_id",
  EMPTY_MESSAGE: "empty_message",
  PLAN_REJECTED: "plan_rejected",
  INSUFFICIENT_CONTEXT: "insufficient_context",
  INSUFFICIENT_EVIDENCE: "insufficient_evidence",
  SPECIALIST_FAILED: "specialist_failed",
  SAFETY_REJECTION: "safety_rejection",
  INVALID_PROPOSAL: "invalid_proposal",
} as const;

export type CoachAgentErrorCode = (typeof COACH_AGENT_ERROR)[keyof typeof COACH_AGENT_ERROR];
