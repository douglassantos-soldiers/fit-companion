/**
 * FASE 15 — rebuild a full AI execution trace from correlation IDs.
 * Uses buildAiAuditTrail + in-memory Agent/Skill/Tool/RAG logs.
 * Catalog IDs (skill_id, tool_id) are never confused with run IDs (skill_run_id, tool_call_id).
 */
import { buildAiAuditTrail, type BuildAiAuditTrailOpts } from "@/ai/governance/correlate";
import type { PipelineStageResult } from "@/ai/e2e/errors";

export type AiExecutionTrace = {
  run_id: string;
  parent_run_id: string | null;
  agent_id: string | null;
  agent_version: string | null;
  /** Catalog skill ids (not run ids). */
  skill_ids: string[];
  skill_run_ids: string[];
  /** Catalog tool ids (not call ids). */
  tool_ids: string[];
  /** Instance ids — ToolCall uses tool_call_id (not tool_run_id). */
  tool_call_ids: string[];
  retrieval_ids: string[];
  decision_ids: string[];
  outcome_ids: string[];
  learning_event_ids: string[];
  context_fingerprint: string | null;
  stages: PipelineStageResult[];
  reconstructed: boolean;
};

export type BuildAiExecutionTraceOpts = BuildAiAuditTrailOpts & {
  stages?: PipelineStageResult[];
};

function agentVersionFrom(
  meta: Record<string, string | number | boolean | null> | undefined,
  auditVersion: string | undefined,
): string | null {
  if (typeof meta?.["agent_version"] === "string") return meta["agent_version"];
  if (auditVersion) return auditVersion;
  return null;
}

/**
 * Reconstruct correlation graph for a root (or child) run_id.
 */
export function buildAiExecutionTrace(
  runId: string,
  opts?: BuildAiExecutionTraceOpts,
): AiExecutionTrace {
  const trail = buildAiAuditTrail(runId, opts);
  const run = trail.agent_run;

  const skill_ids = [...new Set(trail.skill_runs.map((s) => s.skill_id).filter(Boolean))];
  const skill_run_ids = trail.skill_runs.map((s) => s.skill_run_id);

  const tool_ids = [
    ...new Set(trail.tool_calls.map((t) => t.tool_id || t.tool).filter(Boolean)),
  ];
  const tool_call_ids = trail.tool_calls.map((t) => t.tool_call_id);

  const retrieval_ids = trail.rag_retrievals.map((r) => r.retrieval_id);

  const decision_ids = [
    ...new Set(
      trail.decisions
        .map((a) => a.decision_id ?? a.subject_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const outcome_ids = [
    ...new Set(
      trail.outcomes
        .map((a) => a.outcome_id ?? a.subject_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const learning_event_ids = [
    ...new Set(
      trail.learning_events
        .map((a) => a.learning_event_id ?? a.subject_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const agentAudit = trail.audits.find((a) => a.kind === "agent_run" && a.run_id === runId);
  const context_fingerprint =
    run?.context_fingerprint ??
    agentAudit?.context_fingerprint ??
    trail.audits.find((a) => a.context_fingerprint)?.context_fingerprint ??
    null;

  return {
    run_id: runId,
    parent_run_id: run?.parent_run_id ?? agentAudit?.parent_run_id ?? null,
    agent_id: run?.agent_id ?? agentAudit?.agent_id ?? null,
    agent_version: agentVersionFrom(run?.metadata, agentAudit?.agent_version),
    skill_ids,
    skill_run_ids,
    tool_ids,
    tool_call_ids,
    retrieval_ids,
    decision_ids,
    outcome_ids,
    learning_event_ids,
    context_fingerprint,
    stages: opts?.stages ?? [],
    reconstructed: true,
  };
}
