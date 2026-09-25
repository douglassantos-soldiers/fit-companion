/**
 * MCP Tool Layer — error codes (fail-closed).
 */

export const TOOL_ERROR = {
  ANONYMOUS_DENIED: "anonymous_denied",
  UNAUTHORIZED_TOOL: "unauthorized_tool",
  FORGED_USER: "forged_user_context",
  INVALID_INPUT: "invalid_input",
  MALFORMED_OUTPUT: "malformed_output",
  TIMEOUT: "timeout",
  WRITE_NOT_ENABLED: "write_not_enabled",
  SAFETY_BLOCKED: "safety_blocked",
  HANDLER_ERROR: "handler_error",
  INVALID_TRUSTED_USER: "invalid_trusted_user_id",
} as const;

export type ToolErrorCode = (typeof TOOL_ERROR)[keyof typeof TOOL_ERROR];
