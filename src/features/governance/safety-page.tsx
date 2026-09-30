// @ts-nocheck
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGovernanceSafetyFeed } from "@/lib/governance-console.functions";
import { GovernanceShell } from "@/features/governance/shell";

export function GovernanceSafetyPage() {
  const load = useServerFn(getGovernanceSafetyFeed);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load({ data: { limit: 100 } }).then((r) => {
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEvents(r.events);
    });
  }, [load]);

  return (
    <GovernanceShell active="safety">
      <h1 className="text-lg font-semibold">Safety</h1>
      <p className="mt-1 text-xs text-zinc-500">
        Blocks, authorization failures, invalid proposals, cross-user, blocked tools.
      </p>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <ul className="mt-4 divide-y divide-zinc-800 rounded border border-zinc-800">
        {events.map((e) => (
          <li key={String(e["audit_id"])} className="px-3 py-2 text-xs">
            <p className="font-mono text-zinc-200">
              {String(e["kind"])} · {String(e["status"] ?? "")}
            </p>
            <p className="text-zinc-500">
              {String(e["agent_id"] ?? "")} · {String(e["user_id"] ?? "")} ·{" "}
              {String((e["metadata"] as Record<string, unknown> | null)?.["error_code"] ?? "")} ·{" "}
              {String(e["summary"] ?? "")}
            </p>
          </li>
        ))}
        {!events.length && !error ? (
          <li className="px-3 py-6 text-zinc-500">Nenhum evento de safety no período.</li>
        ) : null}
      </ul>
    </GovernanceShell>
  );
}
