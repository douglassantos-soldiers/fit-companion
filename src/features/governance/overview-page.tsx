import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGovernanceOverview } from "@/lib/governance-console.functions";
import { GovernanceShell, MetricCard, pct } from "@/features/governance/shell";
import type { AiMetrics } from "@/ai/governance/metrics";

export function GovernanceOverviewPage() {
  const load = useServerFn(getGovernanceOverview);
  const [metrics, setMetrics] = useState<AiMetrics | null>(null);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load({ data: { limit: 500 } }).then((r) => {
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMetrics(r.metrics);
      setSource(r.source);
    });
  }, [load]);

  return (
    <GovernanceShell active="overview">
      <h1 className="text-lg font-semibold">Overview</h1>
      <p className="mt-1 text-xs text-zinc-500">Fonte: {source || "…"}</p>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {metrics ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Agent runs" value={metrics.sample_size.agents} />
          <MetricCard label="Success rate" value={pct(metrics.agent_success_rate)} />
          <MetricCard label="Error rate" value={pct(metrics.agent_failure_rate)} />
          <MetricCard label="Safety rejection" value={pct(metrics.safety_rejection_rate)} />
          <MetricCard label="Tool error rate" value={pct(metrics.tool_error_rate)} />
          <MetricCard label="RAG failure rate" value={pct(metrics.rag_failure_rate)} />
          <MetricCard label="Avg latency p50" value={`${metrics.latency.p50_ms} ms`} />
          <MetricCard label="Latency p95" value={`${metrics.latency.p95_ms} ms`} />
          <MetricCard label="Est. cost" value={metrics.estimated_cost} />
          <MetricCard
            label="Tokens in/out"
            value={`${metrics.token_usage.input}/${metrics.token_usage.output}`}
          />
          <MetricCard label="Decisions" value={metrics.sample_size.decisions} />
          <MetricCard label="Outcomes" value={metrics.sample_size.outcomes} />
        </div>
      ) : !error ? (
        <p className="mt-4 text-sm text-zinc-500">Carregando métricas…</p>
      ) : null}
    </GovernanceShell>
  );
}
