/**
 * Audit durability classification — CRITICAL vs OBSERVATIONAL (FASE 21 / 22.6).
 */
import type { AiAuditEvent, AiAuditKind } from "@/ai/governance/audit";

export type AuditDurability = "critical" | "observational";

/** Kinds that are always durable when emitted. */
const ALWAYS_CRITICAL_KINDS = new Set<AiAuditKind>([
  "decision",
  "outcome",
  "learning_event",
]);

export function classifyAuditDurability(event: AiAuditEvent): AuditDurability {
  if (ALWAYS_CRITICAL_KINDS.has(event.kind)) return "critical";

  const status = (event.status ?? "").toLowerCase();
  if (
    status === "blocked_by_safety" ||
    status === "denied" ||
    status === "unauthorized" ||
    status.includes("safety") ||
    status.includes("security")
  ) {
    return "critical";
  }

  const err = String(event.metadata?.["error_code"] ?? "").toLowerCase();
  if (
    err === "unauthorized_tool" ||
    err === "forged_user" ||
    err === "safety_rejection" ||
    err === "invalid_proposal" ||
    err === "audit_persistence_failed" ||
    err.includes("unauthorized") ||
    err.includes("security")
  ) {
    return "critical";
  }

  if (
    (event.kind === "agent_run" ||
      event.kind === "skill_run" ||
      event.kind === "tool_call") &&
    (status === "denied" ||
      status === "failed" ||
      status === "unauthorized" ||
      status === "blocked_by_safety")
  ) {
    if (
      !status ||
      status === "denied" ||
      status === "unauthorized" ||
      status === "blocked_by_safety" ||
      err.includes("unauthorized") ||
      err.includes("forbid") ||
      err.includes("security") ||
      err.includes("safety")
    ) {
      return "critical";
    }
  }

  if (event.kind === "tool_call" && (status === "denied" || status === "failed")) {
    if (err.includes("unauthorized") || err.includes("forbid") || err.includes("security")) {
      return "critical";
    }
  }

  // RAG used as evidence for a Decision must be reconstructible.
  if (event.kind === "rag_retrieval") {
    if (event.decision_id) return "critical";
    if (event.metadata?.["used_for_decision"] === true) return "critical";
  }

  if (event.kind === "proposal_merge" && (status.includes("invalid") || status.includes("safety"))) {
    return "critical";
  }

  return "observational";
}
