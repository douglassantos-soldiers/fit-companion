/**
 * Aggregate AI governance metrics from in-memory audit / run buffers.
 */
import { listAgentRuns } from "@/ai/agents/runtime/agent-run-log";
import { listAudits, type AiAuditEvent } from "@/ai/governance/audit";
import { listRagRetrievals } from "@/ai/governance/rag-retrieval-log";
import { listSkillRuns } from "@/ai/skills/core/skill-run-log";
import { listToolCalls } from "@/ai/mcp/core/tool-call-log";

export type AiLatencyStats = {
  p50_ms: number;
  p95_ms: number;
  count: number;
};

export type AiMetrics = {
  agent_success_rate: number;
  agent_failure_rate: number;
  tool_error_rate: number;
  rag_hit_rate: number;
  retrieval_relevance: number;
  decision_success_rate: number;
  action_adherence: number;
  outcome_quality: number;
  latency: AiLatencyStats;
  token_usage: { input: number; output: number };
  estimated_cost: number;
  sample_size: {
    agents: number;
    tools: number;
    rag: number;
    decisions: number;
    outcomes: number;
  };
};

export type ComputeAiMetricsOpts = {
  /** ISO lower bound (inclusive). */
  since?: string;
  /** ISO upper bound (inclusive). */
  until?: string;
  /** Default memory buffers. `db` uses injected `audits` rows only. */
  source?: "memory" | "db";
  /** When provided (or source=db), metrics derive from these audit events. */
  audits?: AiAuditEvent[];
};

function inWindow(iso: string | undefined, opts?: ComputeAiMetricsOpts): boolean {
  if (!iso) return true;
  if (opts?.since && iso < opts.since) return false;
  if (opts?.until && iso > opts.until) return false;
  return true;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

function rate(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 1000;
}

/** Metrics purely from audit events (DB or injected). */
export function computeAiMetricsFromAudits(
  auditsIn: AiAuditEvent[],
  opts?: ComputeAiMetricsOpts,
): AiMetrics {
  const audits = auditsIn.filter((a) => inWindow(a.created_at, opts));
  const agents = audits.filter((a) => a.kind === "agent_run");
  const tools = audits.filter((a) => a.kind === "tool_call");
  const rag = audits.filter((a) => a.kind === "rag_retrieval");
  const skills = audits.filter((a) => a.kind === "skill_run");

  const agentDone = agents.filter((a) =>
    ["completed", "failed", "blocked_by_safety", "cancelled"].includes(a.status ?? ""),
  );
  const agentOk = agentDone.filter((a) => a.status === "completed").length;
  const agentFail = agentDone.filter(
    (a) => a.status === "failed" || a.status === "blocked_by_safety",
  ).length;
  const toolErr = tools.filter((t) => t.status === "failed" || t.status === "denied").length;
  const ragHits = rag.filter((r) => {
    const n = r.metadata?.["hit_count"];
    return typeof n === "number" ? n > 0 : r.status === "hit";
  }).length;
  const topScores = rag
    .map((r) => r.metadata?.["top_score"])
    .filter((v): v is number => typeof v === "number");
  const retrieval_relevance =
    topScores.length === 0
      ? 0
      : Math.round((topScores.reduce((a, b) => a + b, 0) / topScores.length) * 1000) / 1000;

  const decisions = audits.filter((a) => a.kind === "decision");
  const decisionOk = decisions.filter(
    (a) => a.status === "ok" || a.status === "active" || a.status === "success",
  ).length;
  const outcomes = audits.filter((a) => a.kind === "outcome");
  const adherenceVals = outcomes
    .map((o) => o.metadata?.["adherence"])
    .filter((v): v is number => typeof v === "number");
  const action_adherence =
    adherenceVals.length === 0
      ? 0
      : Math.round((adherenceVals.reduce((a, b) => a + b, 0) / adherenceVals.length) * 1000) / 1000;
  const outcomeOk = outcomes.filter(
    (o) => o.status === "success" || o.metadata?.["quality"] === "success",
  ).length;

  const latencies: number[] = [];
  for (const a of [...agents, ...skills, ...tools, ...rag]) {
    if (typeof a.latency_ms === "number") latencies.push(a.latency_ms);
  }
  latencies.sort((x, y) => x - y);

  let tokenIn = 0;
  let tokenOut = 0;
  let cost = 0;
  for (const a of audits) {
    if (a.token_usage?.input) tokenIn += a.token_usage.input;
    if (a.token_usage?.output) tokenOut += a.token_usage.output;
    if (typeof a.estimated_cost === "number") cost += a.estimated_cost;
  }

  return {
    agent_success_rate: rate(agentOk, agentDone.length),
    agent_failure_rate: rate(agentFail, agentDone.length),
    tool_error_rate: rate(toolErr, tools.length),
    rag_hit_rate: rate(ragHits, rag.length),
    retrieval_relevance,
    decision_success_rate: rate(decisionOk, decisions.length),
    action_adherence,
    outcome_quality: rate(outcomeOk, outcomes.length),
    latency: {
      p50_ms: percentile(latencies, 50),
      p95_ms: percentile(latencies, 95),
      count: latencies.length,
    },
    token_usage: { input: tokenIn, output: tokenOut },
    estimated_cost: Math.round(cost * 1000) / 1000,
    sample_size: {
      agents: agents.length,
      tools: tools.length,
      rag: rag.length,
      decisions: decisions.length,
      outcomes: outcomes.length,
    },
  };
}

export function computeAiMetrics(opts?: ComputeAiMetricsOpts): AiMetrics {
  if (opts?.source === "db" || opts?.audits) {
    return computeAiMetricsFromAudits(opts.audits ?? listAudits(1000), opts);
  }

  const agents = listAgentRuns().filter((r) => inWindow(r.created_at, opts));
  const tools = listToolCalls(500).filter((t) => inWindow(t.created_at, opts));
  const skills = listSkillRuns(500).filter((s) => inWindow(s.created_at, opts));
  const rag = listRagRetrievals(500).filter((r) => inWindow(r.created_at, opts));
  const audits = listAudits(1000).filter((a) => inWindow(a.created_at, opts));

  const agentDone = agents.filter((a) =>
    ["completed", "failed", "blocked_by_safety", "cancelled"].includes(a.status),
  );
  const agentOk = agentDone.filter((a) => a.status === "completed").length;
  const agentFail = agentDone.filter(
    (a) => a.status === "failed" || a.status === "blocked_by_safety",
  ).length;

  const toolErr = tools.filter((t) => t.status === "failed" || t.status === "denied").length;
  const ragHits = rag.filter((r) => r.hits.length > 0).length;
  const topScores = rag.map((r) => r.hits[0]?.score ?? 0);
  const retrieval_relevance =
    topScores.length === 0
      ? 0
      : Math.round((topScores.reduce((a, b) => a + b, 0) / topScores.length) * 1000) / 1000;

  const decisions = audits.filter((a) => a.kind === "decision");
  const decisionOk = decisions.filter(
    (a) => a.status === "ok" || a.status === "active" || a.status === "success",
  ).length;

  const outcomes = audits.filter((a) => a.kind === "outcome");
  const adherenceVals = outcomes
    .map((o) => o.metadata?.["adherence"])
    .filter((v): v is number => typeof v === "number");
  const action_adherence =
    adherenceVals.length === 0
      ? 0
      : Math.round((adherenceVals.reduce((a, b) => a + b, 0) / adherenceVals.length) * 1000) / 1000;
  const outcomeOk = outcomes.filter(
    (o) => o.status === "success" || o.metadata?.["quality"] === "success",
  ).length;

  const latencies: number[] = [];
  for (const a of agents) {
    const metaLat = a.metadata?.["latency_ms"];
    if (typeof metaLat === "number") latencies.push(metaLat);
    else if (a.started_at && a.finished_at) {
      const ms = Date.parse(a.finished_at) - Date.parse(a.started_at);
      if (Number.isFinite(ms) && ms >= 0) latencies.push(ms);
    }
  }
  for (const s of skills) {
    if (typeof s.latency_ms === "number") latencies.push(s.latency_ms);
  }
  for (const t of tools) {
    if (typeof t.latency_ms === "number") latencies.push(t.latency_ms);
  }
  latencies.sort((a, b) => a - b);

  let tokenIn = 0;
  let tokenOut = 0;
  let cost = 0;
  for (const a of audits) {
    if (a.token_usage?.input) tokenIn += a.token_usage.input;
    if (a.token_usage?.output) tokenOut += a.token_usage.output;
    if (typeof a.estimated_cost === "number") cost += a.estimated_cost;
  }
  for (const a of agents) {
    const c = a.metadata?.["estimated_cost"];
    if (typeof c === "number") cost += c;
  }

  return {
    agent_success_rate: rate(agentOk, agentDone.length),
    agent_failure_rate: rate(agentFail, agentDone.length),
    tool_error_rate: rate(toolErr, tools.length),
    rag_hit_rate: rate(ragHits, rag.length),
    retrieval_relevance,
    decision_success_rate: rate(decisionOk, decisions.length),
    action_adherence,
    outcome_quality: rate(outcomeOk, outcomes.length),
    latency: {
      p50_ms: percentile(latencies, 50),
      p95_ms: percentile(latencies, 95),
      count: latencies.length,
    },
    token_usage: { input: tokenIn, output: tokenOut },
    estimated_cost: Math.round(cost * 1000) / 1000,
    sample_size: {
      agents: agents.length,
      tools: tools.length,
      rag: rag.length,
      decisions: decisions.length,
      outcomes: outcomes.length,
    },
  };
}

/** Helper for tests — inject audit-shaped rows without re-exporting internals. */
export function summarizeAuditKinds(audits: AiAuditEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of audits) {
    out[a.kind] = (out[a.kind] ?? 0) + 1;
  }
  return out;
}
