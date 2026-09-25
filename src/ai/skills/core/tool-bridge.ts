/**
 * Skills Framework — tool bridge (Skills → MCP invokeTool only).
 */
import { asTrustedUserId, type TrustedUserId } from "@/ai/contracts/trusted-user-id";
import { invokeTool } from "@/ai/mcp/core/invoke";
import type { DomainContextLoader } from "@/ai/mcp/core/types";
import type { SkillCallTool } from "@/ai/skills/core/types";

export function createToolBridge(opts: {
  userId: TrustedUserId;
  date?: string;
  loader?: DomainContextLoader;
  agentId?: string;
  runId?: string;
}): SkillCallTool {
  const userId = asTrustedUserId(opts.userId);
  return async (toolId, input = {}) => {
    const payload = { ...input };
    if (opts.date && payload["date"] === undefined) payload["date"] = opts.date;
    const res = await invokeTool({
      toolId,
      trustedUserId: userId,
      input: payload,
      agentId: opts.agentId ?? "skill",
      ...(opts.loader ? { loader: opts.loader } : {}),
      ...(opts.runId ? { runId: opts.runId } : {}),
    });
    if (!res.ok) {
      return {
        ok: false,
        error_code: res.error_code ?? "tool_failed",
      };
    }
    return { ok: true, data: res.data };
  };
}
