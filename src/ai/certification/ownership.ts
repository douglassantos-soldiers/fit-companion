/**
 * Ownership helpers for AI governance server paths (pure — unit-testable).
 * Never trust client-supplied userId for ownership.
 */

export function parseListIgnoresClientUserId(input: unknown): {
  deviceId: string;
  runId?: string;
  limit?: number;
  clientUserIdIgnored: boolean;
} {
  const v = input as { deviceId?: string; runId?: string; limit?: number; userId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const out: {
    deviceId: string;
    runId?: string;
    limit?: number;
    clientUserIdIgnored: boolean;
  } = {
    deviceId,
    clientUserIdIgnored: typeof v?.userId === "string" && v.userId.trim().length > 0,
  };
  if (v?.runId?.trim()) out.runId = v.runId.trim();
  if (typeof v?.limit === "number") out.limit = v.limit;
  return out;
}

/** Diagnostic ownership: trusted user must own audits or agent_run user_id. */
export function assertDiagnosticOwnership(opts: {
  trustedUserId: string;
  auditUserIds: string[];
  agentUserId: string | null | undefined;
}): { ok: true } | { ok: false; error: "forbidden" } {
  const owned =
    opts.auditUserIds.some((u) => u === opts.trustedUserId) ||
    opts.agentUserId === opts.trustedUserId ||
    opts.agentUserId == null ||
    opts.agentUserId === "";
  // If audits exist for another user only → forbidden
  if (opts.auditUserIds.length > 0 && opts.auditUserIds.every((u) => u !== opts.trustedUserId)) {
    if (opts.agentUserId && opts.agentUserId !== opts.trustedUserId) {
      return { ok: false, error: "forbidden" };
    }
    if (!opts.agentUserId) return { ok: false, error: "forbidden" };
  }
  if (!owned && opts.agentUserId && opts.agentUserId !== opts.trustedUserId) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true };
}
