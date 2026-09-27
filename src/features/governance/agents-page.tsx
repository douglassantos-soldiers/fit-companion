import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listGovernanceAgentStats } from "@/lib/governance-console.functions";
import { GovernanceShell, pct } from "@/features/governance/shell";

type AgentRow = {
  agent_id: string;
  agent_version: string | null;
  runs: number;
  completed: number;
  failed: number;
  safety_blocked: number;
  success_rate: number;
  avg_latency_ms: number;
  estimated_cost: number;
};

export function GovernanceAgentsPage() {
  const load = useServerFn(listGovernanceAgentStats);
  const [agentFilter, setAgentFilter] = useState("");
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    void load({
      data: {
        limit: 500,
        ...(agentFilter.trim() ? { agent_id: agentFilter.trim() } : {}),
      },
    }).then((r) => {
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setRows(r.agents as AgentRow[]);
      setError(null);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GovernanceShell active="agents">
      <h1 className="text-lg font-semibold">Agent monitoring</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          placeholder="Filtrar agent_id"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-900"
          onClick={refresh}
        >
          Aplicar
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-2">Agent</th>
              <th className="py-2 pr-2">Version</th>
              <th className="py-2 pr-2">Runs</th>
              <th className="py-2 pr-2">Success</th>
              <th className="py-2 pr-2">Errors</th>
              <th className="py-2 pr-2">Safety</th>
              <th className="py-2 pr-2">Latency</th>
              <th className="py-2 pr-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.agent_id} className="border-t border-zinc-800">
                <td className="py-2 pr-2 font-mono">{r.agent_id}</td>
                <td className="py-2 pr-2">{r.agent_version ?? "—"}</td>
                <td className="py-2 pr-2 tabular-nums">{r.runs}</td>
                <td className="py-2 pr-2 tabular-nums">{pct(r.success_rate)}</td>
                <td className="py-2 pr-2 tabular-nums">{r.failed}</td>
                <td className="py-2 pr-2 tabular-nums">{r.safety_blocked}</td>
                <td className="py-2 pr-2 tabular-nums">{r.avg_latency_ms} ms</td>
                <td className="py-2 pr-2 tabular-nums">{r.estimated_cost}</td>
              </tr>
            ))}
            {!rows.length && !error ? (
              <tr>
                <td colSpan={8} className="py-6 text-zinc-500">
                  Nenhum agent run no período.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </GovernanceShell>
  );
}
