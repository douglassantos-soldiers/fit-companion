/**
 * AgentRun — one traced execution of an Agent.
 * Every agent execution must be auditable and attributable to a user/session.
 * user_id MUST come from resolveTrustedIdentity / asTrustedUserId — never from client body.
 */

import type { TrustedUserId } from "./trusted-user-id";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "awaiting_tools"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked_by_safety";

export type AgentRun = {
  run_id: string;
  agent_id: string;
  /** TrustedUserId from session identity only. */
  user_id: TrustedUserId | string;
  parent_run_id?: string;
  status: AgentRunStatus;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  /** Link to PerformanceContext fingerprint / decision context when available. */
  context_fingerprint?: string;
  decision_ids?: string[];
  tool_call_ids?: string[];
  skill_run_ids?: string[];
  error_code?: string;
  error_message?: string;
  metadata?: Record<string, string | number | boolean | null>;
};
