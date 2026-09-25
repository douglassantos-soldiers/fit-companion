/**
 * Specialist Agent runtime errors.
 */

export const AGENT_ERROR = {
  ANONYMOUS_DENIED: "anonymous_denied",
  INVALID_TRUSTED_USER: "invalid_trusted_user_id",
  UNKNOWN_AGENT: "unknown_agent",
  PLAN_REQUIRED: "plan_required",
  AGENT_FAILED: "agent_failed",
  TIMEOUT: "timeout",
} as const;

export type AgentErrorCode = (typeof AGENT_ERROR)[keyof typeof AGENT_ERROR];

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  constructor(code: AgentErrorCode, message: string) {
    super(message);
    this.name = "AgentError";
    this.code = code;
  }
}
