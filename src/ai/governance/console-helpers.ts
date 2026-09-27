/**
 * Pure helpers for Governance Console (FASE 19) — no Decision Engine changes.
 */

import type { AiAuditEvent } from "@/ai/governance/audit";
import { redactForAudit } from "@/ai/governance/redact";
import type { AgentRunDiagnosticView } from "@/ai/governance/diagnostics";

export function truncateUserId(userId: string): string {
  const s = String(userId ?? "");
  if (s.length <= 8) return `user_****`;
  return `user_****${s.slice(-4)}`;
}

export function redactAuditForConsole(event: AiAuditEvent): Record<string, unknown> {
  return redactForAudit({
    audit_id: event.audit_id,
    kind: event.kind,
    user_id: truncateUserId(String(event.user_id)),
    created_at: event.created_at,
    subject_id: event.subject_id,
    run_id: event.run_id ?? null,
    parent_run_id: event.parent_run_id ?? null,
    agent_id: event.agent_id ?? null,
    agent_version: event.agent_version ?? null,
    skill_id: event.skill_id ?? null,
    tool_id: event.tool_id ?? null,
    retrieval_id: event.retrieval_id ?? null,
    decision_id: event.decision_id ?? null,
    outcome_id: event.outcome_id ?? null,
    learning_event_id: event.learning_event_id ?? null,
    context_fingerprint: event.context_fingerprint ?? null,
    status: event.status ?? null,
    latency_ms: event.latency_ms ?? null,
    model: event.model ?? null,
    estimated_cost: event.estimated_cost ?? null,
    token_usage: event.token_usage ?? null,
    summary: event.summary ?? null,
    metadata: event.metadata ?? null,
    governance_version: event.governance_version,
  }) as Record<string, unknown>;
}

export type TraceNode = {
  stage: string;
  id: string | null;
  status: string | null;
  latency_ms: number | null;
  error_code: string | null;
  detail: Record<string, unknown> | null;
};

/** Build ordered timeline from diagnostic + audits (never invents missing stages). */
export function buildRunTraceTimeline(
  diagnostic: AgentRunDiagnosticView,
  audits: AiAuditEvent[],
): TraceNode[] {
  const nodes: TraceNode[] = [];
  const agent = diagnostic.sections.agent;
  nodes.push({
    stage: "Agent",
    id: typeof agent["run_id"] === "string" ? agent["run_id"] : diagnostic.run_id,
    status: typeof agent["status"] === "string" ? agent["status"] : null,
    latency_ms: typeof agent["latency_ms"] === "number" ? agent["latency_ms"] : null,
    error_code: typeof agent["error_code"] === "string" ? agent["error_code"] : null,
    detail: { agent_id: agent["agent_id"] ?? null, version: agent["agent_version"] ?? null },
  });

  for (const s of diagnostic.sections.skills) {
    const row = s as Record<string, unknown>;
    nodes.push({
      stage: "Skill",
      id: typeof row["skill_run_id"] === "string" ? row["skill_run_id"] : String(row["skill_id"] ?? null),
      status: typeof row["status"] === "string" ? row["status"] : null,
      latency_ms: typeof row["latency_ms"] === "number" ? row["latency_ms"] : null,
      error_code: typeof row["error_code"] === "string" ? row["error_code"] : null,
      detail: { skill_id: row["skill_id"] ?? null },
    });
  }

  for (const t of diagnostic.sections.tools) {
    const row = t as Record<string, unknown>;
    nodes.push({
      stage: "Tool",
      id: typeof row["tool_call_id"] === "string" ? row["tool_call_id"] : String(row["tool_id"] ?? null),
      status: typeof row["status"] === "string" ? row["status"] : null,
      latency_ms: typeof row["latency_ms"] === "number" ? row["latency_ms"] : null,
      error_code: typeof row["error_code"] === "string" ? row["error_code"] : null,
      detail: { tool_id: row["tool_id"] ?? row["tool"] ?? null },
    });
  }

  for (const r of diagnostic.sections.rag) {
    const row = r as Record<string, unknown>;
    nodes.push({
      stage: "RAG",
      id: typeof row["retrieval_id"] === "string" ? row["retrieval_id"] : null,
      status: typeof row["status"] === "string" ? row["status"] : null,
      latency_ms: typeof row["latency_ms"] === "number" ? row["latency_ms"] : null,
      error_code: null,
      detail: { hit_count: row["hit_count"] ?? null, top_score: row["top_score"] ?? null },
    });
  }

  const memAudits = audits.filter(
    (a) =>
      typeof a.metadata?.["memory_count"] === "number" ||
      (typeof a.summary === "string" && a.summary.includes("memory")),
  );
  if (memAudits.length || diagnostic.sections.context) {
    nodes.push({
      stage: "Memory",
      id: null,
      status: memAudits.length ? "ok" : "unknown",
      latency_ms: null,
      error_code: null,
      detail: {
        context_fingerprint: diagnostic.sections.context["fingerprint"] ?? null,
        memory_refs: memAudits.length,
      },
    });
  }

  const proposalAudit = audits.find(
    (a) => a.kind === "proposal_merge" || a.metadata?.["proposal_id"] != null,
  );
  nodes.push({
    stage: "Proposal",
    id:
      typeof proposalAudit?.metadata?.["proposal_id"] === "string"
        ? proposalAudit.metadata["proposal_id"]
        : proposalAudit?.subject_id ?? null,
    status: proposalAudit?.status ?? (diagnostic.sections.decision["proposal_id"] ? "present" : "unknown"),
    latency_ms: null,
    error_code: null,
    detail: {
      proposal_id: diagnostic.sections.decision["proposal_id"] ?? null,
    },
  });

  const safetyBlocked =
    agent["status"] === "blocked_by_safety" ||
    audits.some((a) => a.status === "blocked_by_safety" || a.metadata?.["error_code"] === "safety_rejection");
  nodes.push({
    stage: "Safety",
    id: null,
    status: safetyBlocked ? "blocked" : "ok",
    latency_ms: null,
    error_code: safetyBlocked ? "safety_rejection" : null,
    detail: null,
  });

  const dec = diagnostic.sections.decision;
  nodes.push({
    stage: "Decision",
    id: typeof dec["decision_id"] === "string" ? dec["decision_id"] : null,
    status: typeof dec["status"] === "string" ? dec["status"] : null,
    latency_ms: null,
    error_code: null,
    detail: {
      reason_codes: dec["reason_codes"] ?? null,
      engine_version: dec["engine_version"] ?? null,
    },
  });

  const outcomeAudits = audits.filter((a) => a.kind === "outcome");
  nodes.push({
    stage: "Outcome",
    id: outcomeAudits[0]?.outcome_id ?? outcomeAudits[0]?.subject_id ?? null,
    status: outcomeAudits[0]?.status ?? (outcomeAudits.length ? "present" : "unknown"),
    latency_ms: null,
    error_code: null,
    detail: outcomeAudits[0]
      ? {
          expected: outcomeAudits[0].metadata?.["expected"] ?? null,
          quality: outcomeAudits[0].metadata?.["quality"] ?? null,
        }
      : null,
  });

  return nodes.map((n) => ({
    ...n,
    detail: n.detail ? (redactForAudit(n.detail) as Record<string, unknown>) : null,
  }));
}

export function filterSafetyFeed(audits: AiAuditEvent[]): AiAuditEvent[] {
  return audits.filter((a) => {
    const code = a.metadata?.["error_code"];
    const status = a.status ?? "";
    return (
      status === "blocked_by_safety" ||
      status === "denied" ||
      status === "unauthorized" ||
      code === "safety_rejection" ||
      code === "authorization_error" ||
      code === "invalid_proposal" ||
      code === "wrong_user" ||
      code === "cross_user" ||
      code === "unauthorized_tool" ||
      (typeof code === "string" && code.includes("unauthorized"))
    );
  });
}

export function groupAgentStats(audits: AiAuditEvent[]): Array<{
  agent_id: string;
  agent_version: string | null;
  runs: number;
  completed: number;
  failed: number;
  safety_blocked: number;
  success_rate: number;
  avg_latency_ms: number;
  estimated_cost: number;
}> {
  const map = new Map<
    string,
    {
      agent_id: string;
      agent_version: string | null;
      runs: number;
      completed: number;
      failed: number;
      safety_blocked: number;
      latency_sum: number;
      latency_n: number;
      estimated_cost: number;
    }
  >();

  for (const a of audits.filter((x) => x.kind === "agent_run")) {
    const id = a.agent_id ?? "unknown";
    const row = map.get(id) ?? {
      agent_id: id,
      agent_version: a.agent_version ?? null,
      runs: 0,
      completed: 0,
      failed: 0,
      safety_blocked: 0,
      latency_sum: 0,
      latency_n: 0,
      estimated_cost: 0,
    };
    row.runs += 1;
    if (a.status === "completed") row.completed += 1;
    if (a.status === "failed") row.failed += 1;
    if (a.status === "blocked_by_safety") row.safety_blocked += 1;
    if (typeof a.latency_ms === "number") {
      row.latency_sum += a.latency_ms;
      row.latency_n += 1;
    }
    if (typeof a.estimated_cost === "number") row.estimated_cost += a.estimated_cost;
    if (a.agent_version) row.agent_version = a.agent_version;
    map.set(id, row);
  }

  return [...map.values()].map((r) => ({
    agent_id: r.agent_id,
    agent_version: r.agent_version,
    runs: r.runs,
    completed: r.completed,
    failed: r.failed,
    safety_blocked: r.safety_blocked,
    success_rate: r.runs ? Math.round((r.completed / r.runs) * 1000) / 1000 : 0,
    avg_latency_ms: r.latency_n ? Math.round(r.latency_sum / r.latency_n) : 0,
    estimated_cost: Math.round(r.estimated_cost * 1000) / 1000,
  }));
}
