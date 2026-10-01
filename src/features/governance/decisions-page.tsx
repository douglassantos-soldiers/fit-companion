import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getGovernanceDecisionTrace,
  listGovernanceDecisions,
  listGovernanceLearning,
  listGovernanceOutcomes,
} from "@/lib/governance-console.functions";
import { GovernanceShell } from "@/features/governance/shell";
import type { ConsoleAuditRow } from "@/ai/governance/console-helpers";

type DecisionTraceDetail = {
  ok: true;
  decision: ConsoleAuditRow | null;
  outcomes: ConsoleAuditRow[];
  learning: ConsoleAuditRow[];
  related: ConsoleAuditRow[];
};

export function GovernanceDecisionsPage() {
  const listDec = useServerFn(listGovernanceDecisions);
  const getTrace = useServerFn(getGovernanceDecisionTrace);
  const listOut = useServerFn(listGovernanceOutcomes);
  const listLearn = useServerFn(listGovernanceLearning);
  const [decisions, setDecisions] = useState<ConsoleAuditRow[]>([]);
  const [outcomes, setOutcomes] = useState<ConsoleAuditRow[]>([]);
  const [learning, setLearning] = useState<ConsoleAuditRow[]>([]);
  const [detail, setDetail] = useState<DecisionTraceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      listDec({ data: { limit: 40 } }),
      listOut({ data: { limit: 40 } }),
      listLearn({ data: { limit: 40 } }),
    ]).then(([d, o, l]) => {
      if (!d.ok || !o.ok || !l.ok) {
        setError("unauthorized");
        return;
      }
      setDecisions(d.decisions);
      setOutcomes(o.outcomes);
      setLearning(l.events);
    });
  }, [listDec, listOut, listLearn]);

  return (
    <GovernanceShell active="decisions">
      <h1 className="text-lg font-semibold">Decisions · Outcome · Learning</h1>
      <p className="mt-1 text-xs text-zinc-500">
        Somente leitura — UI não altera lógica de decisão nem learning signals.
      </p>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-sm text-zinc-300">Decisions</h2>
          <ul className="mt-2 divide-y divide-zinc-800 rounded border border-zinc-800">
            {decisions.map((d) => {
              const id = d.decision_id ?? d.subject_id ?? "";
              return (
                <li key={d.audit_id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-900"
                    onClick={() => {
                      void getTrace({ data: { decisionId: id } }).then((r) => {
                        if (r.ok) setDetail(r);
                      });
                    }}
                  >
                    <span className="font-mono">{id || "—"}</span>
                    <span className="mt-0.5 block text-zinc-500">
                      {d.status ?? ""} · {d.agent_id ?? ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <h2 className="mt-6 text-sm text-zinc-300">Outcomes</h2>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {outcomes.slice(0, 15).map((o) => (
              <li key={o.audit_id} className="font-mono">
                {o.outcome_id ?? o.subject_id} → decision {o.decision_id ?? "—"} ·{" "}
                {o.status ?? ""}
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-sm text-zinc-300">Learning events</h2>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {learning.slice(0, 15).map((e) => (
              <li key={e.audit_id} className="font-mono">
                {e.learning_event_id ?? e.subject_id} · {e.summary ?? e.status ?? ""}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm text-zinc-300">Decision trace</h2>
          {detail ? (
            <pre className="mt-2 max-h-[28rem] overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-[11px] text-zinc-400">
              {JSON.stringify(detail, null, 2)}
            </pre>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">Selecione uma decision.</p>
          )}
        </div>
      </div>
    </GovernanceShell>
  );
}
