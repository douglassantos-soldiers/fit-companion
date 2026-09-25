/**
 * Unified AI audit ring buffer — AgentRun → LearningEvent.
 * In-memory only (FASE 10). Never stores secrets.
 */
import { asTrustedUserId, type TrustedUserId } from "@/ai/contracts/trusted-user-id";
import { redactMetadata } from "@/ai/governance/redact";
import { AI_GOVERNANCE_CONTRACT_VERSION, AI_GOVERNANCE_VERSION } from "@/ai/governance/version";
import { toTrustedUserId, type TrustedIdentity } from "@/lib/session-identity.server";

export type AiAuditKind =
  | "agent_run"
  | "skill_run"
  | "tool_call"
  | "rag_retrieval"
  | "decision"
  | "outcome"
  | "learning_event";

/** @deprecated Prefer AiAuditKind — kept for callers of auditFromIdentity. */
export type GovernanceAuditKind = AiAuditKind;

export type AiTokenUsage = {
  input?: number;
  output?: number;
};

export type AiAuditEvent = {
  audit_id: string;
  kind: AiAuditKind;
  user_id: TrustedUserId | string;
  created_at: string;
  subject_id: string;
  run_id?: string;
  parent_run_id?: string;
  agent_id?: string;
  agent_version?: string;
  skill_id?: string;
  tool_id?: string;
  retrieval_id?: string;
  decision_id?: string;
  outcome_id?: string;
  learning_event_id?: string;
  context_fingerprint?: string;
  status?: string;
  latency_ms?: number;
  model?: string | null;
  token_usage?: AiTokenUsage | null;
  estimated_cost?: number | null;
  summary?: string;
  metadata?: Record<string, string | number | boolean | null>;
  session_id?: string | null;
  role?: string;
  governance_version: string;
  contract_version: number;
};

/** Legacy alias used by earlier stub. */
export type GovernanceAuditRecord = AiAuditEvent;

const MAX = 1000;
const buffer: AiAuditEvent[] = [];

function newAuditId(kind: AiAuditKind): string {
  return `audit_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clearAuditLog(): void {
  buffer.length = 0;
}

export function listAudits(limit = 200): AiAuditEvent[] {
  return buffer.slice(-Math.max(1, limit));
}

export function listAuditsByRunId(runId: string): AiAuditEvent[] {
  return buffer.filter((a) => a.run_id === runId || a.parent_run_id === runId);
}

export function recordAudit(
  partial: Omit<
    AiAuditEvent,
    "audit_id" | "governance_version" | "contract_version" | "created_at"
  > & {
    created_at?: string;
    audit_id?: string;
  },
): AiAuditEvent {
  const meta = redactMetadata(partial.metadata);
  const event: AiAuditEvent = {
    audit_id: partial.audit_id ?? newAuditId(partial.kind),
    kind: partial.kind,
    user_id: partial.user_id,
    created_at: partial.created_at ?? new Date().toISOString(),
    subject_id: partial.subject_id,
    governance_version: AI_GOVERNANCE_VERSION,
    contract_version: AI_GOVERNANCE_CONTRACT_VERSION,
  };
  if (partial.run_id) event.run_id = partial.run_id;
  if (partial.parent_run_id) event.parent_run_id = partial.parent_run_id;
  if (partial.agent_id) event.agent_id = partial.agent_id;
  if (partial.agent_version) event.agent_version = partial.agent_version;
  if (partial.skill_id) event.skill_id = partial.skill_id;
  if (partial.tool_id) event.tool_id = partial.tool_id;
  if (partial.retrieval_id) event.retrieval_id = partial.retrieval_id;
  if (partial.decision_id) event.decision_id = partial.decision_id;
  if (partial.outcome_id) event.outcome_id = partial.outcome_id;
  if (partial.learning_event_id) event.learning_event_id = partial.learning_event_id;
  if (partial.context_fingerprint) event.context_fingerprint = partial.context_fingerprint;
  if (partial.status) event.status = partial.status;
  if (partial.latency_ms != null) event.latency_ms = partial.latency_ms;
  if (partial.model !== undefined) event.model = partial.model;
  if (partial.token_usage !== undefined) event.token_usage = partial.token_usage;
  if (partial.estimated_cost !== undefined) event.estimated_cost = partial.estimated_cost;
  if (partial.summary) event.summary = partial.summary.slice(0, 240);
  if (meta) event.metadata = meta;
  if (partial.session_id !== undefined) event.session_id = partial.session_id;
  if (partial.role) event.role = partial.role;

  buffer.push(event);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);

  // FASE 11 — dual-write best-effort (server only; never blocks callers)
  if (typeof window === "undefined" && process.env["AI_AUDIT_PERSIST"] !== "0") {
    void import("@/ai/governance/persist.server")
      .then((m) => m.schedulePersistAiAudit(event))
      .catch(() => {});
  }

  return event;
}

/**
 * Build an audit record stamped with trusted identity.
 * Agents/Tools must call this instead of inventing user_id.
 */
export function auditFromIdentity(
  identity: TrustedIdentity,
  kind: AiAuditKind,
  subjectId: string,
  extras?: Partial<
    Omit<
      AiAuditEvent,
      | "audit_id"
      | "kind"
      | "user_id"
      | "created_at"
      | "subject_id"
      | "governance_version"
      | "contract_version"
    >
  >,
): AiAuditEvent {
  const userId = asTrustedUserId(toTrustedUserId(identity));
  return recordAudit({
    kind,
    user_id: userId,
    subject_id: subjectId,
    session_id: identity.sessionId,
    role: identity.role,
    ...extras,
  });
}

export function recordDecisionAudit(opts: {
  userId: string;
  decisionId: string;
  runId?: string;
  status?: string;
  summary?: string;
  contextFingerprint?: string;
  metadata?: Record<string, string | number | boolean | null>;
}): AiAuditEvent {
  return recordAudit({
    kind: "decision",
    user_id: opts.userId,
    subject_id: opts.decisionId,
    decision_id: opts.decisionId,
    ...(opts.runId ? { run_id: opts.runId } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.summary ? { summary: opts.summary } : {}),
    ...(opts.contextFingerprint ? { context_fingerprint: opts.contextFingerprint } : {}),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
  });
}

export function recordOutcomeAudit(opts: {
  userId: string;
  outcomeId: string;
  decisionId?: string;
  runId?: string;
  quality?: string;
  adherence?: number | null;
  summary?: string;
}): AiAuditEvent {
  const meta: Record<string, string | number | boolean | null> = {};
  if (opts.quality) meta["quality"] = opts.quality;
  if (opts.adherence != null) meta["adherence"] = opts.adherence;
  return recordAudit({
    kind: "outcome",
    user_id: opts.userId,
    subject_id: opts.outcomeId,
    outcome_id: opts.outcomeId,
    ...(opts.decisionId ? { decision_id: opts.decisionId } : {}),
    ...(opts.runId ? { run_id: opts.runId } : {}),
    ...(opts.quality ? { status: opts.quality } : {}),
    ...(opts.summary ? { summary: opts.summary } : {}),
    ...(Object.keys(meta).length ? { metadata: meta } : {}),
  });
}

export function recordLearningEventAudit(opts: {
  userId: string;
  eventId: string;
  decisionId?: string;
  outcomeId?: string;
  runId?: string;
  kind?: string;
  confidence?: number;
  blocked?: boolean;
  summary?: string;
}): AiAuditEvent {
  const meta: Record<string, string | number | boolean | null> = {};
  if (opts.kind) meta["learning_kind"] = opts.kind;
  if (opts.confidence != null) meta["confidence"] = opts.confidence;
  if (opts.blocked != null) meta["blocked_by_guardrail"] = opts.blocked;
  return recordAudit({
    kind: "learning_event",
    user_id: opts.userId,
    subject_id: opts.eventId,
    learning_event_id: opts.eventId,
    ...(opts.decisionId ? { decision_id: opts.decisionId } : {}),
    ...(opts.outcomeId ? { outcome_id: opts.outcomeId } : {}),
    ...(opts.runId ? { run_id: opts.runId } : {}),
    ...(opts.summary ? { summary: opts.summary } : {}),
    ...(Object.keys(meta).length ? { metadata: meta } : {}),
  });
}

/** Bridge Learning cycle result → audit events (public helper; not auto-wired in hot path). */
export function auditLearningCycleResult(opts: {
  userId: string;
  runId?: string;
  events: Array<{
    event_id: string;
    kind: string;
    decision_id?: string;
    outcome_id?: string;
    confidence: number;
    blocked_by_guardrail?: boolean;
  }>;
  signals?: Array<{ signalId: string; narrative: string; confidence: number }>;
}): AiAuditEvent[] {
  const out: AiAuditEvent[] = [];
  for (const e of opts.events) {
    out.push(
      recordLearningEventAudit({
        userId: opts.userId,
        eventId: e.event_id,
        ...(e.decision_id ? { decisionId: e.decision_id } : {}),
        ...(e.outcome_id ? { outcomeId: e.outcome_id } : {}),
        ...(opts.runId ? { runId: opts.runId } : {}),
        kind: e.kind,
        confidence: e.confidence,
        blocked: Boolean(e.blocked_by_guardrail),
        ...(opts.signals?.[0]?.narrative ? { summary: opts.signals[0].narrative } : {}),
      }),
    );
  }
  return out;
}
