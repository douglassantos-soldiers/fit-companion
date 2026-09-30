// @ts-nocheck
/**
 * FASE 19 — Governance Console server fns (admin/analyst read-only).
 * Never mutates Decision Engine / Living Plan / Learning.
 */
import { createServerFn } from "@tanstack/react-start";
import { listAudits } from "@/ai/governance/audit";
import {
  computeAiMetrics,
  computeAiMetricsFromAudits,
  computeCostBreakdown,
} from "@/ai/governance/metrics";
import { diagnoseAgentRun } from "@/ai/governance/diagnostics";
import { runAiEvaluation } from "@/ai/governance/eval/runner";
import { runAiEvaluationV2 } from "@/ai/governance/eval/runner-v2";
import {
  buildRunTraceTimeline,
  filterSafetyFeed,
  groupAgentStats,
  redactAuditForConsole,
  truncateUserId,
} from "@/ai/governance/console-helpers";
import { redactForAudit } from "@/ai/governance/redact";
import { assertGovAdmin } from "@/lib/governance-console-auth";

export { assertGovAdmin, GOV_CONSOLE_ROLES, unauthorizedOrContinue } from "@/lib/governance-console-auth";

function parseFilters(input: unknown): {
  since?: string;
  until?: string;
  kind?: string;
  agent_id?: string;
  status?: string;
  user_id?: string;
  model?: string;
  cursor?: string;
  limit?: number;
  runId?: string;
  decisionId?: string;
} {
  const v = (input ?? {}) as Record<string, unknown>;
  const out: ReturnType<typeof parseFilters> = {};
  if (typeof v["since"] === "string" && v["since"].trim()) out.since = v["since"].trim();
  if (typeof v["until"] === "string" && v["until"].trim()) out.until = v["until"].trim();
  if (typeof v["kind"] === "string" && v["kind"].trim()) out.kind = v["kind"].trim();
  if (typeof v["agent_id"] === "string" && v["agent_id"].trim()) out.agent_id = v["agent_id"].trim();
  if (typeof v["status"] === "string" && v["status"].trim()) out.status = v["status"].trim();
  if (typeof v["user_id"] === "string" && v["user_id"].trim()) out.user_id = v["user_id"].trim();
  if (typeof v["model"] === "string" && v["model"].trim()) out.model = v["model"].trim();
  if (typeof v["cursor"] === "string" && v["cursor"].trim()) out.cursor = v["cursor"].trim();
  if (typeof v["limit"] === "number") out.limit = v["limit"];
  if (typeof v["runId"] === "string" && v["runId"].trim()) out.runId = v["runId"].trim();
  if (typeof v["decisionId"] === "string" && v["decisionId"].trim()) {
    out.decisionId = v["decisionId"].trim();
  }
  return out;
}

async function loadConsoleAudits(filters: ReturnType<typeof parseFilters>) {
  const { loadAuditsAdmin } = await import("@/ai/governance/persist.server");
  const loaded = await loadAuditsAdmin({
    ...(filters.since ? { since: filters.since } : {}),
    ...(filters.until ? { until: filters.until } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.agent_id ? { agent_id: filters.agent_id } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.user_id ? { user_id: filters.user_id } : {}),
    ...(filters.model ? { model: filters.model } : {}),
    ...(filters.cursor ? { cursor: filters.cursor } : {}),
    limit: filters.limit ?? 100,
  });
  if (loaded.source === "db") {
    return { audits: loaded.audits, source: "db" as const, next_cursor: loaded.next_cursor };
  }
  // Fallback: in-memory ring when DB unavailable (never invents rows)
  let mem = listAudits(1000);
  if (filters.since) mem = mem.filter((a) => a.created_at >= filters.since!);
  if (filters.until) mem = mem.filter((a) => a.created_at <= filters.until!);
  if (filters.kind) mem = mem.filter((a) => a.kind === filters.kind);
  if (filters.agent_id) mem = mem.filter((a) => a.agent_id === filters.agent_id);
  if (filters.status) mem = mem.filter((a) => a.status === filters.status);
  if (filters.user_id) mem = mem.filter((a) => String(a.user_id) === filters.user_id);
  if (filters.model) mem = mem.filter((a) => a.model === filters.model);
  mem.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const limit = Math.min(200, filters.limit ?? 100);
  const slice = mem.slice(0, limit);
  return {
    audits: slice,
    source: (slice.length > 0 ? "memory" : "unavailable") as "memory" | "unavailable",
    next_cursor: null as string | null,
  };
}

export const getGovernanceOverview = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const };
    }
    const { audits, source } = await loadConsoleAudits({ ...data, limit: data.limit ?? 500 });
    const metrics =
      source === "memory" && audits.length === 0
        ? computeAiMetrics({ source: "memory", ...(data.since ? { since: data.since } : {}), ...(data.until ? { until: data.until } : {}) })
        : computeAiMetricsFromAudits(audits, {
            ...(data.since ? { since: data.since } : {}),
            ...(data.until ? { until: data.until } : {}),
          });
    return {
      ok: true as const,
      source,
      metrics,
      decision_count: metrics.sample_size.decisions,
      agent_run_count: metrics.sample_size.agents,
    };
  });

export const listGovernanceAgentStats = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const, agents: [] };
    }
    const { audits, source } = await loadConsoleAudits({
      ...data,
      kind: "agent_run",
      limit: data.limit ?? 500,
    });
    return { ok: true as const, source, agents: groupAgentStats(audits) };
  });

export const listGovernanceRuns = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const, runs: [], next_cursor: null };
    }
    const { audits, source, next_cursor } = await loadConsoleAudits({
      ...data,
      kind: data.kind ?? "agent_run",
      limit: data.limit ?? 50,
    });
    const runs = audits.map((a) => redactAuditForConsole(a));
    return { ok: true as const, source, runs, next_cursor };
  });

export const getGovernanceRunTrace = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const };
    }
    const runId = data.runId;
    if (!runId) return { ok: false as const, error: "runId_required" as const };

    const { loadAuditsAdmin } = await import("@/ai/governance/persist.server");
    const { listAuditsByRunId } = await import("@/ai/governance/audit");
    const dbPage = await loadAuditsAdmin({ limit: 200 });
    const dbRelated = dbPage.audits.filter(
      (a) => a.run_id === runId || a.parent_run_id === runId,
    );
    const mem = listAuditsByRunId(runId);
    const seen = new Set<string>();
    const audits = [...dbRelated, ...mem].filter((a) => {
      if (seen.has(a.audit_id)) return false;
      seen.add(a.audit_id);
      return true;
    });

    const diagnostic = diagnoseAgentRun(runId, { extraAudits: audits });
    const timeline = buildRunTraceTimeline(diagnostic, audits);
    return {
      ok: true as const,
      run_id: runId,
      diagnostic: redactForAudit(diagnostic) as Record<string, unknown>,
      timeline,
      audits: audits.map(redactAuditForConsole),
    };
  });

export const listGovernanceDecisions = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const, decisions: [] };
    }
    const { audits, source, next_cursor } = await loadConsoleAudits({
      ...data,
      kind: "decision",
      limit: data.limit ?? 50,
    });
    return {
      ok: true as const,
      source,
      decisions: audits.map(redactAuditForConsole),
      next_cursor,
    };
  });

export const getGovernanceDecisionTrace = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const };
    }
    const decisionId = data.decisionId;
    if (!decisionId) return { ok: false as const, error: "decisionId_required" as const };
    const { audits } = await loadConsoleAudits({ limit: 500 });
    const related = audits.filter(
      (a) =>
        a.decision_id === decisionId ||
        a.subject_id === decisionId ||
        a.metadata?.["decision_id"] === decisionId,
    );
    const decision = related.find((a) => a.kind === "decision") ?? related[0] ?? null;
    const outcomes = related.filter((a) => a.kind === "outcome");
    const learning = related.filter((a) => a.kind === "learning_event");
    return {
      ok: true as const,
      decision: decision ? redactAuditForConsole(decision) : null,
      outcomes: outcomes.map(redactAuditForConsole),
      learning: learning.map(redactAuditForConsole),
      related: related.map(redactAuditForConsole),
    };
  });

export const getGovernanceCostBreakdown = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const };
    }
    const { audits, source } = await loadConsoleAudits({ ...data, limit: data.limit ?? 500 });
    const breakdown = computeCostBreakdown(audits);
    // Truncate user ids in by_user
    const by_user = breakdown.by_user.map((u) => ({
      ...u,
      user_id: truncateUserId(u.user_id),
    }));
    return { ok: true as const, source, ...breakdown, by_user };
  });

export const getGovernanceSafetyFeed = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const, events: [] };
    }
    const { audits, source } = await loadConsoleAudits({ ...data, limit: data.limit ?? 200 });
    const events = filterSafetyFeed(audits).map(redactAuditForConsole);
    return { ok: true as const, source, events };
  });

export const listGovernanceRag = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const, retrievals: [] };
    }
    const { audits, source, next_cursor } = await loadConsoleAudits({
      ...data,
      kind: "rag_retrieval",
      limit: data.limit ?? 50,
    });
    return {
      ok: true as const,
      source,
      retrievals: audits.map(redactAuditForConsole),
      next_cursor,
    };
  });

export const listGovernanceOutcomes = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const, outcomes: [] };
    }
    const { audits, source } = await loadConsoleAudits({
      ...data,
      kind: "outcome",
      limit: data.limit ?? 50,
    });
    return { ok: true as const, source, outcomes: audits.map(redactAuditForConsole) };
  });

export const listGovernanceLearning = createServerFn({ method: "POST" })
  .inputValidator(parseFilters)
  .handler(async ({ data }) => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const, events: [] };
    }
    const { audits, source } = await loadConsoleAudits({
      ...data,
      kind: "learning_event",
      limit: data.limit ?? 50,
    });
    return { ok: true as const, source, events: audits.map(redactAuditForConsole) };
  });

export const runGovernanceEvaluation = createServerFn({ method: "POST" })
  .inputValidator(() => ({}))
  .handler(async () => {
    try {
      assertGovAdmin();
    } catch {
      return { ok: false as const, error: "unauthorized" as const };
    }
    const suite = runAiEvaluation();
    const report = runAiEvaluationV2();
    return {
      ok: true as const,
      suite: redactForAudit(suite) as Record<string, unknown>,
      report: redactForAudit(report) as Record<string, unknown>,
    };
  });
