/**
 * MCP Tool Layer — invoke pipeline.
 * Agent → AuthN → AuthZ → Validate → Safety(optional) → Handler → Domain
 * Never Agent → Database.
 */
import type { ToolCall } from "@/ai/contracts/tool-call";
import { authorizeToolInvoke } from "@/ai/mcp/core/auth";
import { defaultDomainContextLoader } from "@/ai/mcp/core/domain-loader";
import { TOOL_ERROR } from "@/ai/mcp/core/errors";
import { hashInput, newToolCallId, redactInput } from "@/ai/mcp/core/hash";
import { getTool } from "@/ai/mcp/core/registry";
import { recordToolCall } from "@/ai/mcp/core/tool-call-log";
import type { ToolInvokeRequest, ToolInvokeResult } from "@/ai/mcp/core/types";
import { validateToolInput, validateToolOutput } from "@/ai/mcp/core/validate";

const DEFAULT_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(TOOL_ERROR.TIMEOUT)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function invokeTool(req: ToolInvokeRequest): Promise<ToolInvokeResult> {
  const created_at = new Date().toISOString();
  const started = Date.now();
  const tool = getTool(req.toolId);
  const tool_call_id = newToolCallId();
  const agent_id = req.agentId ?? "system";
  const run_id = req.runId ?? `run_${tool_call_id}`;

  const baseCall = (): ToolCall => ({
    tool_call_id,
    tool: req.toolId,
    tool_id: req.toolId,
    run_id,
    agent_id,
    user_id: req.trustedUserId ?? "",
    status: "queued",
    created_at,
  });

  const finish = (
    partial: Omit<ToolInvokeResult, "tool_call"> & { tool_call?: Partial<ToolCall> },
  ): ToolInvokeResult => {
    const latency_ms = Date.now() - started;
    const call: ToolCall = {
      ...baseCall(),
      ...partial.tool_call,
      status: partial.status,
      latency_ms,
      finished_at: new Date().toISOString(),
      started_at: created_at,
    };
    if (partial.error_code) call.error_code = partial.error_code;
    if (partial.error_message) call.error_message = partial.error_message;
    if (partial.status === "denied" && partial.error_code) {
      call.denied_reason = partial.error_code;
    }
    recordToolCall(call);
    const result: ToolInvokeResult = {
      ok: partial.ok,
      status: partial.status,
      tool_call: call,
    };
    if (partial.data !== undefined) result.data = partial.data;
    if (partial.error_code) result.error_code = partial.error_code;
    if (partial.error_message) result.error_message = partial.error_message;
    return result;
  };

  const authzArgs: {
    trustedUserId: string | null;
    tool: typeof tool;
    targetUserId?: string;
  } = {
    trustedUserId: req.trustedUserId,
    tool,
  };
  if (req.targetUserId !== undefined) authzArgs.targetUserId = req.targetUserId;
  const authz = authorizeToolInvoke(authzArgs);
  if (!authz.ok) {
    return finish({
      ok: false,
      status: "denied",
      error_code: authz.error_code,
      error_message: authz.error_message,
      tool_call: { user_id: req.trustedUserId ?? "" },
    });
  }

  const registered = tool!;
  const validated = validateToolInput(req.input ?? {}, registered.input_schema);
  if (!validated.ok) {
    return finish({
      ok: false,
      status: "failed",
      error_code: validated.error_code,
      error_message: validated.error_message,
      tool_call: {
        user_id: authz.userId,
        input_hash: hashInput({}),
        args_summary: {},
      },
    });
  }

  const input_hash = hashInput(validated.value);
  const args_summary = redactInput(validated.value);

  if (registered.classification === "write") {
    return finish({
      ok: false,
      status: "denied",
      error_code: TOOL_ERROR.WRITE_NOT_ENABLED,
      error_message: "write_tools_architecture_only",
      tool_call: {
        user_id: authz.userId,
        input_hash,
        args_summary,
      },
    });
  }

  if (registered.requires_safety_gate) {
    // Safety gate reserved for future write/side-effect tools — READ tools should not set this.
    return finish({
      ok: false,
      status: "denied",
      error_code: TOOL_ERROR.SAFETY_BLOCKED,
      error_message: "safety_gate_required",
      tool_call: { user_id: authz.userId, input_hash, args_summary },
    });
  }

  const loader = req.loader ?? defaultDomainContextLoader;
  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const ctx = await withTimeout(
      Promise.resolve(
        loader(
          authz.userId,
          typeof validated.value["date"] === "string" ? validated.value["date"] : undefined,
        ),
      ),
      timeoutMs,
    );
    const data = await withTimeout(
      Promise.resolve(registered.handler(ctx, validated.value)),
      timeoutMs,
    );
    const outCheck = validateToolOutput(data, registered.output_schema);
    if (!outCheck.ok) {
      return finish({
        ok: false,
        status: "failed",
        error_code: outCheck.error_code,
        error_message: outCheck.error_message,
        tool_call: { user_id: authz.userId, input_hash, args_summary },
      });
    }
    return finish({
      ok: true,
      status: "completed",
      data,
      tool_call: {
        user_id: authz.userId,
        input_hash,
        args_summary,
        result_summary: { ok: true },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg === TOOL_ERROR.TIMEOUT || /timeout/i.test(msg);
    return finish({
      ok: false,
      status: "failed",
      error_code: isTimeout ? TOOL_ERROR.TIMEOUT : TOOL_ERROR.HANDLER_ERROR,
      error_message: isTimeout ? "tool_timeout" : msg.slice(0, 200),
      tool_call: { user_id: authz.userId, input_hash, args_summary },
    });
  }
}
