import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runGovernanceEvaluation } from "@/lib/governance-console.functions";
import { GovernanceShell, MetricCard } from "@/features/governance/shell";
import type { ConsoleJson } from "@/ai/governance/console-helpers";

function asRecord(value: ConsoleJson | null): { [key: string]: ConsoleJson } | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

export function GovernanceEvaluationPage() {
  const run = useServerFn(runGovernanceEvaluation);
  const [suite, setSuite] = useState<{ [key: string]: ConsoleJson } | null>(null);
  const [report, setReport] = useState<{ [key: string]: ConsoleJson } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <GovernanceShell active="evaluation">
      <h1 className="text-lg font-semibold">Evaluation</h1>
      <p className="mt-1 text-xs text-zinc-500">
        Suite v1 + Evaluation 2.0 (golden) — read-only; não altera Decision Engine.
      </p>
      <button
        type="button"
        disabled={busy}
        className="mt-4 rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
        onClick={() => {
          setBusy(true);
          setError(null);
          void run({ data: {} })
            .then((r) => {
              if (!r.ok) {
                setError(r.error);
                return;
              }
              setSuite(asRecord(r.suite));
              setReport(asRecord(r.report ?? null));
            })
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Executando…" : "Rodar evaluation suite"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {suite ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Gov passed" value={Number(suite["passed"] ?? 0)} />
            <MetricCard label="Gov failed" value={Number(suite["failed"] ?? 0)} />
            <MetricCard label="Gov total" value={Number(suite["total"] ?? 0)} />
          </div>
          {report ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Eval version" value={String(report["evaluation_version"] ?? "")} />
              <MetricCard label="Dataset" value={String(report["dataset_version"] ?? "")} />
              <MetricCard label="Report ok" value={String(report["ok"] ?? "")} />
            </div>
          ) : null}
          <pre className="max-h-96 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-[11px] text-zinc-400">
            {JSON.stringify({ suite, report }, null, 2)}
          </pre>
        </div>
      ) : null}
    </GovernanceShell>
  );
}
