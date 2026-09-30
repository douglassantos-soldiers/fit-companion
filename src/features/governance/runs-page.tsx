// @ts-nocheck
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getGovernanceRunTrace,
  listGovernanceRuns,
} from "@/lib/governance-console.functions";
import { GovernanceShell } from "@/features/governance/shell";
import type { TraceNode } from "@/ai/governance/console-helpers";

export function GovernanceRunsPage() {
  const listRuns = useServerFn(listGovernanceRuns);
  const getTrace = useServerFn(getGovernanceRunTrace);
  const [runs, setRuns] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TraceNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  const refresh = (next?: string | null) => {
    void listRuns({
      data: {
        kind: "agent_run",
        limit: 40,
        ...(next ? { cursor: next } : {}),
      },
    }).then((r) => {
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setRuns((prev) => (next ? [...prev, ...r.runs] : r.runs));
      setCursor(r.next_cursor);
      setError(null);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTrace = (runId: string) => {
    setSelected(runId);
    void getTrace({ data: { runId } }).then((r) => {
      if (!r.ok) {
        setError("error" in r ? String(r.error) : "trace_failed");
        setTimeline([]);
        return;
      }
      setTimeline((r.timeline as TraceNode[]) ?? []);
    });
  };

  return (
    <GovernanceShell active="runs">
      <h1 className="text-lg font-semibold">Runs &amp; Trace</h1>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <ul className="divide-y divide-zinc-800 rounded border border-zinc-800">
            {runs.map((run) => {
              const runId = String(run["run_id"] ?? run["subject_id"] ?? "");
              return (
                <li key={String(run["audit_id"] ?? runId)}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-zinc-900 ${
                      selected === runId ? "bg-zinc-900" : ""
                    }`}
                    onClick={() => openTrace(runId)}
                  >
                    <span className="font-mono text-zinc-200">{runId || "—"}</span>
                    <span className="mt-0.5 block text-zinc-500">
                      {String(run["agent_id"] ?? "")} · {String(run["status"] ?? "")} ·{" "}
                      {String(run["created_at"] ?? "")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {cursor ? (
            <button
              type="button"
              className="mt-2 text-xs text-zinc-400 underline"
              onClick={() => refresh(cursor)}
            >
              Mais
            </button>
          ) : null}
        </div>
        <div>
          <h2 className="text-sm font-medium text-zinc-300">
            Timeline {selected ? `(${selected})` : ""}
          </h2>
          {!selected ? (
            <p className="mt-2 text-xs text-zinc-500">Selecione um run.</p>
          ) : (
            <ol className="mt-3 space-y-2 border-l border-zinc-700 pl-4">
              {timeline.map((node, i) => (
                <li key={`${node.stage}-${i}`} className="relative text-xs">
                  <span className="absolute -left-[1.15rem] top-1 h-2 w-2 rounded-full bg-zinc-400" />
                  <p className="font-medium text-zinc-200">{node.stage}</p>
                  <p className="text-zinc-500">
                    {node.id ?? "—"} · {node.status ?? "unknown"}
                    {node.latency_ms != null ? ` · ${node.latency_ms}ms` : ""}
                    {node.error_code ? ` · ${node.error_code}` : ""}
                  </p>
                </li>
              ))}
              {!timeline.length ? (
                <li className="text-zinc-500">Dados insuficientes para o trace.</li>
              ) : null}
            </ol>
          )}
        </div>
      </div>
    </GovernanceShell>
  );
}
