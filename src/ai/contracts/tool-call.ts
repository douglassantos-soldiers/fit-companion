/**
 * ToolCall — one traced tool invocation.
 * Every tool call must be auditable (who, what, when, outcome).
 * user_id MUST come from resolveTrustedIdentity / asTrustedUserId — never from client body.
 * Never store secrets or unnecessary PII in summaries.
 */

import type { TrustedUserId } from "./trusted-user-id";

export type ToolCallStatus = "queued" | "running" | "completed" | "failed" | "denied" | "cancelled";

export type ToolCall = {
  tool_call_id: string;
  /** Tool id / name for audit. */
  tool: string;
  tool_id: string;
  run_id: string;
  agent_id: string;
  user_id: TrustedUserId | string;
  skill_run_id?: string;
  status: ToolCallStatus;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  /** Deterministic hash of redacted input — never raw secrets. */
  input_hash?: string;
  latency_ms?: number;
  /** Redacted / summarized args — never store secrets. */
  args_summary?: Record<string, string | number | boolean | null>;
  result_summary?: Record<string, string | number | boolean | null>;
  error_code?: string;
  error_message?: string;
  denied_reason?: string;
};
