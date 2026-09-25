/**
 * SkillRun — one traced execution of a Skill within an AgentRun (or standalone).
 * user_id MUST come from resolveTrustedIdentity / asTrustedUserId — never from client body.
 */

import type { TrustedUserId } from "./trusted-user-id";

export type SkillRunStatus =
  "queued" | "running" | "completed" | "failed" | "cancelled" | "denied" | "blocked_by_safety";

export type SkillRun = {
  skill_run_id: string;
  skill_id: string;
  run_id: string;
  agent_id: string;
  user_id: TrustedUserId | string;
  status: SkillRunStatus;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  latency_ms?: number;
  tool_call_ids?: string[];
  input_summary?: Record<string, string | number | boolean | null>;
  output_summary?: Record<string, string | number | boolean | null>;
  error_code?: string;
  error_message?: string;
};
