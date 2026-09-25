/**
 * Orchestrator — error codes (fail-closed).
 */

export const ORCH_ERROR = {
  ANONYMOUS_DENIED: "anonymous_denied",
  INVALID_TRUSTED_USER: "invalid_trusted_user_id",
  INVALID_AGENT: "invalid_agent",
  INVALID_TOOL: "invalid_tool",
  INVALID_SKILL: "invalid_skill",
  LOOP_DETECTED: "loop_detected",
  TIMEOUT_BUDGET: "timeout_budget_exceeded",
  COST_LIMIT: "cost_limit_exceeded",
  MAX_STEPS: "max_steps_exceeded",
  EMPTY_INTENT: "empty_intent",
} as const;

export type OrchErrorCode = (typeof ORCH_ERROR)[keyof typeof ORCH_ERROR];

export class OrchError extends Error {
  readonly code: OrchErrorCode;
  constructor(code: OrchErrorCode, message: string) {
    super(message);
    this.name = "OrchError";
    this.code = code;
  }
}
