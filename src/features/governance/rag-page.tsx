import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listGovernanceRag } from "@/lib/governance-console.functions";
import { GovernanceShell } from "@/features/governance/shell";
import type { ConsoleAuditRow } from "@/ai/governance/console-helpers";

export function GovernanceRagPage() {
  const load = useServerFn(listGovernanceRag);
  const [rows, setRows] = useState<ConsoleAuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load({ data: { limit: 50 } }).then((r) => {
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setRows(r.retrievals);
    });
  }, [load]);

  return (
    <GovernanceShell active="rag">
      <h1 className="text-lg font-semibold">RAG</h1>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-2">Retrieval</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Hits</th>
              <th className="py-2 pr-2">Top score</th>
              <th className="py-2 pr-2">Source</th>
              <th className="py-2 pr-2">Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = r.metadata ?? {};
              return (
                <tr key={r.audit_id} className="border-t border-zinc-800">
                  <td className="py-2 pr-2 font-mono">{r.retrieval_id ?? r.subject_id}</td>
                  <td className="py-2 pr-2">{r.status ?? ""}</td>
                  <td className="py-2 pr-2 tabular-nums">{meta["hit_count"] ?? "—"}</td>
                  <td className="py-2 pr-2 tabular-nums">{meta["top_score"] ?? "—"}</td>
                  <td className="py-2 pr-2 font-mono">
                    {meta["top_source_id"] ?? meta["top_document_id"] ?? "—"}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{r.latency_ms ?? "—"}</td>
                </tr>
              );
            })}
            {!rows.length && !error ? (
              <tr>
                <td colSpan={6} className="py-6 text-zinc-500">
                  Sem retrievals.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </GovernanceShell>
  );
}
