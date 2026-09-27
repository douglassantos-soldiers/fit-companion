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
  /** Fraction of finished agent runs with status blocked_by_safety */
  safety_rejection_rate: number;
  tool_error_rate: number;
  rag_hit_rate: number;
  /** Fraction of RAG audits that failed / errored */
  rag_failure_rate: number;
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
    safety_blocks: number;
    rag_failures: number;
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
  const safetyBlocks = agentDone.filter((a) => a.status === "blocked_by_safety").length;
  const toolErr = tools.filter((t) => t.status === "failed" || t.status === "denied").length;
  const ragHits = rag.filter((r) => {
    const n = r.metadata?.["hit_count"];
    return typeof n === "number" ? n > 0 : r.status === "hit";
  }).length;
  const ragFailures = rag.filter(
    (r) =>
      r.status === "error" ||
      r.status === "failed" ||
      r.status === "timeout" ||
      r.metadata?.["error_code"] != null,
  ).length;
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
    safety_rejection_rate: rate(safetyBlocks, agentDone.length),
    tool_error_rate: rate(toolErr, tools.length),
    rag_hit_rate: rate(ragHits, rag.length),
    rag_failure_rate: rate(ragFailures, rag.length),
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
      safety_blocks: safetyBlocks,
      rag_failures: ragFailures,
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
  const safetyBlocks = agentDone.filter((a) => a.status === "blocked_by_safety").length;

  const toolErr = tools.filter((t) => t.status === "failed" || t.status === "denied").length;
  const ragHits = rag.filter((r) => r.hits.length > 0).length;
  const ragFailuresMem = audits.filter(
    (a) =>
      a.kind === "rag_retrieval" &&
      (a.status === "error" || a.status === "failed" || a.status === "timeout"),
  ).length;
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
    safety_rejection_rate: rate(safetyBlocks, agentDone.length),
    tool_error_rate: rate(toolErr, tools.length),
    rag_hit_rate: rate(ragHits, rag.length),
    rag_failure_rate: rate(ragFailuresMem, rag.length || audits.filter((a) => a.kind === "rag_retrieval").length),
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
      safety_blocks: safetyBlocks,
      rag_failures: ragFailuresMem,
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

export type CostBreakdownRow = {
  key: string;
  provider: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  actual_cost: number | null;
  events: number;
};

/** Aggregate cost by provider/model from audits (estimated only; actual usually null). */
export function computeCostBreakdown(audits: AiAuditEvent[]): {
  by_model: CostBreakdownRow[];
  by_agent: Array<{ agent_id: string; estimated_cost: number; events: number }>;
  by_user: Array<{ user_id: string; estimated_cost: number; events: number }>;
  cost_per_decision: number;
  total_estimated: number;
} {
  const byModel = new Map<string, CostBreakdownRow>();
  const byAgent = new Map<string, { agent_id: string; estimated_cost: number; events: number }>();
  const byUser = new Map<string, { user_id: string; estimated_cost: number; events: number }>();
  let total = 0;
  let decisionCount = 0;

  for (const a of audits) {
    if (a.kind === "decision") decisionCount += 1;
    const cost = typeof a.estimated_cost === "number" ? a.estimated_cost : 0;
    total += cost;
    const provider =
      typeof a.metadata?.["provider"] === "string" ? a.metadata["provider"] : null;
    const model = typeof a.model === "string" ? a.model : null;
    const key = `${provider ?? "unknown"}:${model ?? "unknown"}`;
    const row = byModel.get(key) ?? {
      key,
      provider,
      model,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost: 0,
      actual_cost: null,
      events: 0,
    };
    row.input_tokens += a.token_usage?.input ?? 0;
    row.output_tokens += a.token_usage?.output ?? 0;
    row.estimated_cost += cost;
    row.events += 1;
    byModel.set(key, row);

    if (a.agent_id) {
      const ag = byAgent.get(a.agent_id) ?? {
        agent_id: a.agent_id,
        estimated_cost: 0,
        events: 0,
      };
      ag.estimated_cost += cost;
      ag.events += 1;
      byAgent.set(a.agent_id, ag);
    }
    const uid = String(a.user_id ?? "unknown");
    const u = byUser.get(uid) ?? { user_id: uid, estimated_cost: 0, events: 0 };
    u.estimated_cost += cost;
    u.events += 1;
    byUser.set(uid, u);
  }

  return {
    by_model: [...byModel.values()].sort((a, b) => b.estimated_cost - a.estimated_cost),
    by_agent: [...byAgent.values()].sort((a, b) => b.estimated_cost - a.estimated_cost),
    by_user: [...byUser.values()].sort((a, b) => b.estimated_cost - a.estimated_cost),
    cost_per_decision: decisionCount > 0 ? Math.round((total / decisionCount) * 1000) / 1000 : 0,
    total_estimated: Math.round(total * 1000) / 1000,
  };
}
