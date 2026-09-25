/**
 * Correlate AgentRun + SkillRun + ToolCall + RAG + Decision/Outcome/Learning audits.
 */
import { listAgentRuns } from "@/ai/agents/runtime/agent-run-log";
import type { AgentRun } from "@/ai/contracts/agent-run";
import type { KnowledgeRetrieval } from "@/ai/contracts/knowledge-retrieval";
import type { SkillRun } from "@/ai/contracts/skill-run";
import type { ToolCall } from "@/ai/contracts/tool-call";
import { listAuditsByRunId, type AiAuditEvent } from "@/ai/governance/audit";
import { listRagRetrievals } from "@/ai/governance/rag-retrieval-log";
import { listSkillRuns } from "@/ai/skills/core/skill-run-log";
import { listToolCalls } from "@/ai/mcp/core/tool-call-log";

export type AiAuditTrail = {
  run_id: string;
  agent_run: AgentRun | null;
  skill_runs: SkillRun[];
  tool_calls: ToolCall[];
  rag_retrievals: KnowledgeRetrieval[];
  audits: AiAuditEvent[];
  decisions: AiAuditEvent[];
  outcomes: AiAuditEvent[];
  learning_events: AiAuditEvent[];
};

export type BuildAiAuditTrailOpts = {
  /** Extra audits (e.g. loaded from Postgres) merged + deduped with memory. */
  extraAudits?: AiAuditEvent[];
};

export function buildAiAuditTrail(runId: string, opts?: BuildAiAuditTrailOpts): AiAuditTrail {
  const agent_run = listAgentRuns().find((r) => r.run_id === runId) ?? null;
  const childRuns = listAgentRuns().filter((r) => r.parent_run_id === runId);
  const relatedRunIds = new Set([runId, ...childRuns.map((r) => r.run_id)]);

  const skill_runs = listSkillRuns(500).filter((s) => relatedRunIds.has(s.run_id));
  const tool_calls = listToolCalls(500).filter((t) => relatedRunIds.has(t.run_id));

  const retrievalIds = new Set<string>();
  for (const r of [agent_run, ...childRuns]) {
    const raw = r?.metadata?.["retrieval_ids"];
    if (typeof raw === "string") {
      for (const id of raw.split(",")) {
        if (id.trim()) retrievalIds.add(id.trim());
      }
    }
  }

  const audits = [
    ...listAuditsByRunId(runId),
    ...childRuns.flatMap((c) => listAuditsByRunId(c.run_id)),
    ...(opts?.extraAudits ?? []).filter(
      (a) => a.run_id === runId || a.parent_run_id === runId || relatedRunIds.has(a.run_id ?? ""),
    ),
  ];
  const seen = new Set<string>();
  const uniqueAudits = audits.filter((a) => {
    if (seen.has(a.audit_id)) return false;
    seen.add(a.audit_id);
    return true;
  });

  for (const a of uniqueAudits) {
    if (a.retrieval_id) retrievalIds.add(a.retrieval_id);
  }

  const rag_retrievals = listRagRetrievals(500).filter((r) => retrievalIds.has(r.retrieval_id));

  // Synthetic AgentRun from audit if memory miss (DB-only path)
  let resolvedRun = agent_run;
  if (!resolvedRun) {
    const agentAudit = uniqueAudits.find((a) => a.kind === "agent_run" && a.run_id === runId);
    if (agentAudit) {
      resolvedRun = {
        run_id: runId,
        agent_id: agentAudit.agent_id ?? "unknown",
        user_id: agentAudit.user_id,
        status: (agentAudit.status as AgentRun["status"]) ?? "completed",
        created_at: agentAudit.created_at,
        ...(agentAudit.parent_run_id ? { parent_run_id: agentAudit.parent_run_id } : {}),
        ...(agentAudit.context_fingerprint
          ? { context_fingerprint: agentAudit.context_fingerprint }
          : {}),
        metadata: {
          ...(agentAudit.agent_version ? { agent_version: agentAudit.agent_version } : {}),
          ...(agentAudit.model ? { model: agentAudit.model } : {}),
          ...(agentAudit.estimated_cost != null
            ? { estimated_cost: agentAudit.estimated_cost }
            : {}),
          ...(agentAudit.latency_ms != null ? { latency_ms: agentAudit.latency_ms } : {}),
        },
      };
    }
  }

  return {
    run_id: runId,
    agent_run: resolvedRun,
    skill_runs,
    tool_calls,
    rag_retrievals,
    audits: uniqueAudits,
    decisions: uniqueAudits.filter((a) => a.kind === "decision"),
    outcomes: uniqueAudits.filter((a) => a.kind === "outcome"),
    learning_events: uniqueAudits.filter((a) => a.kind === "learning_event"),
  };
}
