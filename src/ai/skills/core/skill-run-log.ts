/**
 * Skills Framework — in-memory SkillRun audit log + governance mirror.
 */
import type { SkillRun } from "@/ai/contracts/skill-run";
import { recordAudit } from "@/ai/governance/audit";

const MAX = 500;
const buffer: SkillRun[] = [];

export function recordSkillRun(run: SkillRun): void {
  buffer.push(run);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);

  recordAudit({
    kind: "skill_run",
    user_id: run.user_id,
    subject_id: run.skill_run_id,
    run_id: run.run_id,
    agent_id: run.agent_id,
    skill_id: run.skill_id,
    status: run.status,
    ...(run.latency_ms != null ? { latency_ms: run.latency_ms } : {}),
    created_at: run.created_at,
    summary: run.error_code ? `${run.status}:${run.error_code}` : run.status,
    metadata: {
      ...(run.error_code ? { error_code: run.error_code } : {}),
      ...(run.tool_call_ids?.length ? { tool_call_count: run.tool_call_ids.length } : {}),
    },
  });
}

export function listSkillRuns(limit = 50): SkillRun[] {
  return buffer.slice(-Math.max(1, limit));
}

export function clearSkillRunLog(): void {
  buffer.length = 0;
}
