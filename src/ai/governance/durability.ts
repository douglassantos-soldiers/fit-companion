/**
 * Audit durability classification — CRITICAL vs OBSERVATIONAL (FASE 21).
 */
import type { AiAuditEvent, AiAuditKind } from "@/ai/governance/audit";

export type AuditDurability = "critical" | "observational";

const CRITICAL_KINDS = new Set<AiAuditKind>(["decision"]);

export function classifyAuditDurability(event: AiAuditEvent): AuditDurability {
  if (CRITICAL_KINDS.has(event.kind)) return "critical";

  const status = (event.status ?? "").toLowerCase();
  if (
    status === "blocked_by_safety" ||
    status === "denied" ||
    status === "unauthorized" ||
    status.includes("safety")
  ) {
    return "critical";
  }

  const err = String(event.metadata?.["error_code"] ?? "").toLowerCase();
  if (
    err === "unauthorized_tool" ||
    err === "forged_user" ||
    err === "safety_rejection" ||
    err === "invalid_proposal" ||
    err.includes("unauthorized") ||
    err.includes("security")
  ) {
    return "critical";
  }

  if (event.kind === "tool_call" && (status === "denied" || status === "failed")) {
    if (err.includes("unauthorized") || err.includes("forbid")) return "critical";
  }

  if (event.kind === "proposal_merge" && status.includes("invalid")) return "critical";

  return "observational";
}
