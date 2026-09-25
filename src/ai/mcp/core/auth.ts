/**
 * MCP Tool Layer — authentication / authorization gate.
 */
import { asTrustedUserId, type TrustedUserId } from "@/ai/contracts/trusted-user-id";
import { TOOL_ERROR } from "@/ai/mcp/core/errors";
import type { RegisteredTool } from "@/ai/mcp/core/types";

export type AuthzOk = { ok: true; userId: TrustedUserId };
export type AuthzFail = { ok: false; error_code: string; error_message: string };

export function authorizeToolInvoke(opts: {
  trustedUserId: string | null;
  targetUserId?: string;
  tool: RegisteredTool | undefined;
}): AuthzOk | AuthzFail {
  if (!opts.tool) {
    return {
      ok: false,
      error_code: TOOL_ERROR.UNAUTHORIZED_TOOL,
      error_message: "unknown_or_unregistered_tool",
    };
  }

  const raw = opts.trustedUserId?.trim() ?? "";
  if (!raw) {
    return {
      ok: false,
      error_code: TOOL_ERROR.ANONYMOUS_DENIED,
      error_message: "authentication_required",
    };
  }

  let userId: TrustedUserId;
  try {
    userId = asTrustedUserId(raw);
  } catch {
    return {
      ok: false,
      error_code: TOOL_ERROR.INVALID_TRUSTED_USER,
      error_message: "invalid_trusted_user_id",
    };
  }

  if (opts.targetUserId && opts.targetUserId.trim() && opts.targetUserId.trim() !== userId) {
    return {
      ok: false,
      error_code: TOOL_ERROR.FORGED_USER,
      error_message: "target_user_mismatch",
    };
  }

  if (opts.tool.authorization === "admin") {
    return {
      ok: false,
      error_code: TOOL_ERROR.UNAUTHORIZED_TOOL,
      error_message: "admin_permission_required",
    };
  }

  return { ok: true, userId };
}
