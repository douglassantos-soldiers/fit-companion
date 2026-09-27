/**
 * In-memory AgentRun audit log (lightweight) + governance mirror.
 */

import type { AgentRun } from "@/ai/contracts/agent-run";
import { recordAudit } from "@/ai/governance/audit";

const runs: AgentRun[] = [];
const MAX = 200;

export function recordAgentRun(run: AgentRun): void {
  runs.push(run);
  if (runs.length > MAX) runs.splice(0, runs.length - MAX);

  const latency =
    typeof run.metadata?.["latency_ms"] === "number"
      ? run.metadata["latency_ms"]
      : run.started_at && run.finished_at
        ? Date.parse(run.finished_at) - Date.parse(run.started_at)
        : undefined;

  const tokenUsageRaw = run.metadata?.["token_usage"];
  let token_usage: { input?: number; output?: number } | undefined;
  if (typeof tokenUsageRaw === "string") {
    try {
      const parsed = JSON.parse(tokenUsageRaw) as { input?: number; output?: number };
      if (typeof parsed.input === "number" || typeof parsed.output === "number") {
        token_usage = {
          ...(typeof parsed.input === "number" ? { input: parsed.input } : {}),
          ...(typeof parsed.output === "number" ? { output: parsed.output } : {}),
        };
      }
    } catch {
      /* ignore */
    }
  }
  if (
    !token_usage &&
    (typeof run.metadata?.["input_tokens"] === "number" ||
      typeof run.metadata?.["output_tokens"] === "number")
  ) {
    token_usage = {
      ...(typeof run.metadata["input_tokens"] === "number"
        ? { input: run.metadata["input_tokens"] }
        : {}),
      ...(typeof run.metadata["output_tokens"] === "number"
        ? { output: run.metadata["output_tokens"] }
        : {}),
    };
  }

  recordAudit({
    kind: "agent_run",
    user_id: run.user_id,
    subject_id: run.run_id,
    run_id: run.run_id,
    ...(run.parent_run_id ? { parent_run_id: run.parent_run_id } : {}),
    agent_id: run.agent_id,
    ...(typeof run.metadata?.["agent_version"] === "string"
      ? { agent_version: run.metadata["agent_version"] }
      : {}),
    ...(run.context_fingerprint ? { context_fingerprint: run.context_fingerprint } : {}),
    status: run.status,
    ...(latency != null && Number.isFinite(latency) ? { latency_ms: latency } : {}),
    ...(typeof run.metadata?.["model"] === "string" ? { model: run.metadata["model"] } : {}),
    ...(typeof run.metadata?.["estimated_cost"] === "number"
      ? { estimated_cost: run.metadata["estimated_cost"] }
      : {}),
    ...(token_usage ? { token_usage } : {}),
    created_at: run.created_at,
    summary: run.error_code ? `${run.status}:${run.error_code}` : run.status,
    metadata: {
      ...(run.skill_run_ids?.length ? { skill_run_count: run.skill_run_ids.length } : {}),
      ...(run.tool_call_ids?.length ? { tool_call_count: run.tool_call_ids.length } : {}),
      ...(run.error_code ? { error_code: run.error_code } : {}),
      ...(typeof run.metadata?.["provider"] === "string"
        ? { provider: run.metadata["provider"] }
        : {}),
      ...(typeof run.metadata?.["prompt_version"] === "string"
        ? { prompt_version: run.metadata["prompt_version"] }
        : {}),
      ...(typeof run.metadata?.["runtime_mode"] === "string"
        ? { runtime_mode: run.metadata["runtime_mode"] }
        : {}),
      ...(typeof run.metadata?.["input_tokens"] === "number"
        ? { input_tokens: run.metadata["input_tokens"] }
        : {}),
      ...(typeof run.metadata?.["output_tokens"] === "number"
        ? { output_tokens: run.metadata["output_tokens"] }
        : {}),
    },
  });
}

export function listAgentRuns(): AgentRun[] {
  return [...runs];
}

export function clearAgentRunLog(): void {
  runs.length = 0;
}
