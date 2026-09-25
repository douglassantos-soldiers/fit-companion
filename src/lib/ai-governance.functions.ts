/**
 * Server fns — list AI audits + Agent Run diagnostic (no UI).
 * Auth via resolveTrustedIdentity; never trust client userId.
 */
import { createServerFn } from "@tanstack/react-start";
import type { AiAuditEvent } from "@/ai/governance/audit";
import type { AiMetrics } from "@/ai/governance/metrics";
import { diagnoseAgentRun } from "@/ai/governance/diagnostics";
import { listAuditsByRunId as listMemoryAuditsByRun } from "@/ai/governance/audit";
import { computeAiMetrics } from "@/ai/governance/metrics";
import { toTrustedUserId } from "@/lib/session-identity.server";

function parseList(input: unknown): { deviceId: string; runId?: string; limit?: number } {
  const v = input as { deviceId?: string; runId?: string; limit?: number; userId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const out: { deviceId: string; runId?: string; limit?: number } = { deviceId };
  if (v?.runId?.trim()) out.runId = v.runId.trim();
  if (typeof v?.limit === "number") out.limit = v.limit;
  return out;
}

function parseDiagnose(input: unknown): { deviceId: string; runId: string } {
  const v = input as { deviceId?: string; runId?: string; userId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  const runId = String(v?.runId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  if (!runId) throw new Error("runId obrigatório");
  return { deviceId, runId };
}

type ListResult =
  { ok: true; audits: AiAuditEvent[] } | { ok: false; error: string; audits: AiAuditEvent[] };

type DiagnoseResult =
  { ok: true; diagnostic: Record<string, unknown> } | { ok: false; error: string };

type MetricsResult = { ok: true; metrics: AiMetrics } | { ok: false; error: string; metrics: null };

/** List audits for the trusted user (optional runId filter). Merges DB + memory. */
export const listAiAudits = createServerFn({ method: "POST" })
  .inputValidator(parseList)
  .handler(async ({ data }): Promise<ListResult> => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccess: true,
    });
    if (!identity) return { ok: false, error: "unauthorized", audits: [] };

    const userId = toTrustedUserId(identity);
    const { loadAuditsByRunId, loadAuditsForUser } = await import("@/ai/governance/persist.server");

    let dbAudits = data.runId
      ? await loadAuditsByRunId(userId, data.runId)
      : await loadAuditsForUser(userId, { limit: data.limit ?? 100 });

    dbAudits = dbAudits.filter((a) => a.user_id === userId);

    const mem = data.runId
      ? listMemoryAuditsByRun(data.runId).filter((a) => a.user_id === userId)
      : [];

    const seen = new Set<string>();
    const audits = [...dbAudits, ...mem].filter((a) => {
      if (seen.has(a.audit_id)) return false;
      seen.add(a.audit_id);
      return true;
    });

    return { ok: true, audits };
  });

/** Diagnostic view for one AgentRun (DB + memory merge). */
async function getAgentRunDiagnosticHandler(ctx: {
  data: { deviceId: string; runId: string };
}): Promise<DiagnoseResult> {
  const { data } = ctx;
  const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
  const identity = await resolveTrustedIdentity({
    deviceId: data.deviceId,
    requireAccess: true,
  });
  if (!identity) {
    return { ok: false, error: "unauthorized" };
  }

  const userId = toTrustedUserId(identity);
  const { loadAuditsByRunId } = await import("@/ai/governance/persist.server");
  const dbAudits = (await loadAuditsByRunId(userId, data.runId)).filter(
    (a) => a.user_id === userId,
  );

  const view = diagnoseAgentRun(data.runId, { extraAudits: dbAudits });
  const agentUser = view.sections.agent["user_id"];
  const owned =
    dbAudits.length > 0 || agentUser === userId || agentUser == null || agentUser === "";

  if (!owned) {
    return { ok: false, error: "forbidden" };
  }

  const diagnostic = JSON.parse(JSON.stringify(view)) as Record<string, unknown>;
  return { ok: true, diagnostic };
}

export const getAgentRunDiagnostic = createServerFn({ method: "POST" })
  .inputValidator(parseDiagnose)
  // TanStack ServerFn inference rejects Record<string, unknown> payload unions — cast keep runtime safe.
  .handler(getAgentRunDiagnosticHandler as never);

/** Metrics for trusted user from DB audits (fallback memory). */
export const getAiGovernanceMetrics = createServerFn({ method: "POST" })
  .inputValidator(parseList)
  .handler(async ({ data }): Promise<MetricsResult> => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccess: true,
    });
    if (!identity) return { ok: false, error: "unauthorized", metrics: null };

    const userId = toTrustedUserId(identity);
    const { loadAuditsForUser } = await import("@/ai/governance/persist.server");
    const dbAudits = await loadAuditsForUser(userId, { limit: data.limit ?? 200 });
    const metrics =
      dbAudits.length > 0
        ? computeAiMetrics({ source: "db", audits: dbAudits })
        : computeAiMetrics({ source: "memory" });

    return { ok: true, metrics };
  });
