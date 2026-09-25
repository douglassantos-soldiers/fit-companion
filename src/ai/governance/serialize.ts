/**
 * Serialize / deserialize AiAuditEvent ↔ ai_audit_events row (pure, testable).
 */
import type { AiAuditEvent, AiAuditKind, AiTokenUsage } from "@/ai/governance/audit";
import { redactMetadata } from "@/ai/governance/redact";
import { AI_GOVERNANCE_CONTRACT_VERSION, AI_GOVERNANCE_VERSION } from "@/ai/governance/version";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistableUserId(userId: string): boolean {
  return UUID_RE.test(userId.trim());
}

export type AiAuditEventRow = {
  audit_id: string;
  kind: string;
  user_id: string;
  created_at: string;
  subject_id: string;
  run_id: string | null;
  parent_run_id: string | null;
  agent_id: string | null;
  agent_version: string | null;
  skill_id: string | null;
  tool_id: string | null;
  retrieval_id: string | null;
  decision_id: string | null;
  outcome_id: string | null;
  learning_event_id: string | null;
  context_fingerprint: string | null;
  status: string | null;
  latency_ms: number | null;
  model: string | null;
  estimated_cost: number | null;
  summary: string | null;
  token_usage: AiTokenUsage | null;
  metadata: Record<string, string | number | boolean | null> | null;
  session_id: string | null;
  role: string | null;
  governance_version: string;
  contract_version: number;
};

export function auditEventToRow(event: AiAuditEvent): AiAuditEventRow | null {
  const userId = String(event.user_id ?? "").trim();
  if (!isPersistableUserId(userId)) return null;
  const meta = redactMetadata(event.metadata) ?? null;
  return {
    audit_id: event.audit_id,
    kind: event.kind,
    user_id: userId,
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
    summary: event.summary ?? null,
    token_usage: event.token_usage ?? null,
    metadata: meta,
    session_id: event.session_id ?? null,
    role: event.role ?? null,
    governance_version: event.governance_version || AI_GOVERNANCE_VERSION,
    contract_version: event.contract_version ?? AI_GOVERNANCE_CONTRACT_VERSION,
  };
}

export function rowToAuditEvent(row: Record<string, unknown>): AiAuditEvent {
  const event: AiAuditEvent = {
    audit_id: String(row["audit_id"]),
    kind: row["kind"] as AiAuditKind,
    user_id: String(row["user_id"]),
    created_at: String(row["created_at"]),
    subject_id: String(row["subject_id"]),
    governance_version: String(row["governance_version"] ?? AI_GOVERNANCE_VERSION),
    contract_version: Number(row["contract_version"] ?? AI_GOVERNANCE_CONTRACT_VERSION),
  };
  if (row["run_id"]) event.run_id = String(row["run_id"]);
  if (row["parent_run_id"]) event.parent_run_id = String(row["parent_run_id"]);
  if (row["agent_id"]) event.agent_id = String(row["agent_id"]);
  if (row["agent_version"]) event.agent_version = String(row["agent_version"]);
  if (row["skill_id"]) event.skill_id = String(row["skill_id"]);
  if (row["tool_id"]) event.tool_id = String(row["tool_id"]);
  if (row["retrieval_id"]) event.retrieval_id = String(row["retrieval_id"]);
  if (row["decision_id"]) event.decision_id = String(row["decision_id"]);
  if (row["outcome_id"]) event.outcome_id = String(row["outcome_id"]);
  if (row["learning_event_id"]) event.learning_event_id = String(row["learning_event_id"]);
  if (row["context_fingerprint"]) event.context_fingerprint = String(row["context_fingerprint"]);
  if (row["status"]) event.status = String(row["status"]);
  if (row["latency_ms"] != null) event.latency_ms = Number(row["latency_ms"]);
  if (row["model"] !== undefined && row["model"] !== null) event.model = String(row["model"]);
  if (row["estimated_cost"] != null) event.estimated_cost = Number(row["estimated_cost"]);
  if (row["summary"]) event.summary = String(row["summary"]);
  if (row["token_usage"] && typeof row["token_usage"] === "object") {
    event.token_usage = row["token_usage"] as AiTokenUsage;
  }
  if (row["metadata"] && typeof row["metadata"] === "object") {
    event.metadata = row["metadata"] as Record<string, string | number | boolean | null>;
  }
  if (row["session_id"] !== undefined) {
    event.session_id = row["session_id"] == null ? null : String(row["session_id"]);
  }
  if (row["role"]) event.role = String(row["role"]);
  return event;
}
