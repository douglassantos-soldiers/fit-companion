import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGovernanceCostBreakdown } from "@/lib/governance-console.functions";
import { GovernanceShell, MetricCard } from "@/features/governance/shell";

export function GovernanceCostPage() {
  const load = useServerFn(getGovernanceCostBreakdown);
  const [data, setData] = useState<{
    by_model: Array<Record<string, unknown>>;
    by_agent: Array<Record<string, unknown>>;
    by_user: Array<Record<string, unknown>>;
    cost_per_decision: number;
    total_estimated: number;
    source: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load({ data: { limit: 500 } }).then((r) => {
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData({
        by_model: r.by_model as Array<Record<string, unknown>>,
        by_agent: r.by_agent as Array<Record<string, unknown>>,
        by_user: r.by_user as Array<Record<string, unknown>>,
        cost_per_decision: r.cost_per_decision,
        total_estimated: r.total_estimated,
        source: r.source,
      });
    });
  }, [load]);

  return (
    <GovernanceShell active="cost">
      <h1 className="text-lg font-semibold">Cost</h1>
      <p className="mt-1 text-xs text-zinc-500">
        Estimated only — actual cost geralmente null. Fonte: {data?.source ?? "…"}
      </p>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Total estimated" value={data.total_estimated} />
            <MetricCard label="Cost / decision" value={data.cost_per_decision} />
          </div>
          <h2 className="mt-6 text-sm text-zinc-300">By provider / model</h2>
          <ul className="mt-2 space-y-1 text-xs">
            {data.by_model.map((m) => (
              <li key={String(m["key"])} className="font-mono text-zinc-400">
                {String(m["provider"])}/{String(m["model"])} · tokens{" "}
                {String(m["input_tokens"])}/{String(m["output_tokens"])} · est{" "}
                {String(m["estimated_cost"])} · actual {String(m["actual_cost"])} · events{" "}
                {String(m["events"])}
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-sm text-zinc-300">By agent</h2>
          <ul className="mt-2 space-y-1 text-xs font-mono text-zinc-400">
            {data.by_agent.map((a) => (
              <li key={String(a["agent_id"])}>
                {String(a["agent_id"])} · {String(a["estimated_cost"])} · {String(a["events"])} events
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-sm text-zinc-300">By user (truncated)</h2>
          <ul className="mt-2 space-y-1 text-xs font-mono text-zinc-400">
            {data.by_user.slice(0, 20).map((u) => (
              <li key={String(u["user_id"])}>
                {String(u["user_id"])} · {String(u["estimated_cost"])}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </GovernanceShell>
  );
}
