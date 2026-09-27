import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Page = lazy(() =>
  import("@/features/governance/runs-page").then((m) => ({ default: m.GovernanceRunsPage })),
);

export const Route = createFileRoute("/governance/runs")({
  component: () => (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Carregando…</div>}>
      <Page />
    </Suspense>
  ),
});
