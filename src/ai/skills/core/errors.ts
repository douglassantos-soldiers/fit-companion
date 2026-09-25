/**
 * Skills Framework — error codes.
 */

export const SKILL_ERROR = {
  ANONYMOUS_DENIED: "anonymous_denied",
  UNKNOWN_SKILL: "unknown_skill",
  INVALID_INPUT: "invalid_input",
  INVALID_OUTPUT: "invalid_output",
  MISSING_TOOL: "missing_tool",
  TOOL_FAILED: "tool_failed",
  SKILL_FAILED: "skill_failed",
  INVALID_TRUSTED_USER: "invalid_trusted_user_id",
} as const;

export type SkillErrorCode = (typeof SKILL_ERROR)[keyof typeof SKILL_ERROR];
