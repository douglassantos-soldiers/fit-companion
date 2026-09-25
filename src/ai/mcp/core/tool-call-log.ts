/**
 * MCP Tool Layer — in-memory ToolCall audit log (ring buffer) + governance mirror.
 * Never persists secrets; suitable for tests and process-local tracing.
 */
import type { ToolCall } from "@/ai/contracts/tool-call";
import { recordAudit } from "@/ai/governance/audit";

const MAX = 500;
const buffer: ToolCall[] = [];

export function recordToolCall(call: ToolCall): void {
  buffer.push(call);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);

  recordAudit({
    kind: "tool_call",
    user_id: call.user_id,
    subject_id: call.tool_call_id,
    run_id: call.run_id,
    agent_id: call.agent_id,
    tool_id: call.tool_id || call.tool,
    ...(call.skill_run_id ? { skill_id: call.skill_run_id } : {}),
    status: call.status,
    ...(call.latency_ms != null ? { latency_ms: call.latency_ms } : {}),
    created_at: call.created_at,
    summary: call.error_code ? `${call.status}:${call.error_code}` : call.status,
    metadata: {
      ...(call.error_code ? { error_code: call.error_code } : {}),
      ...(call.denied_reason ? { denied_reason: call.denied_reason.slice(0, 120) } : {}),
      ...(call.input_hash ? { input_hash: call.input_hash } : {}),
    },
  });
}

export function listToolCalls(limit = 50): ToolCall[] {
  return buffer.slice(-Math.max(1, limit));
}

export function clearToolCallLog(): void {
  buffer.length = 0;
}

export function findToolCall(toolCallId: string): ToolCall | undefined {
  return buffer.find((c) => c.tool_call_id === toolCallId);
}
