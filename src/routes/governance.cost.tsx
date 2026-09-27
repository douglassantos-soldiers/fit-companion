import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Page = lazy(() =>
  import("@/features/governance/cost-page").then((m) => ({ default: m.GovernanceCostPage })),
);

export const Route = createFileRoute("/governance/cost")({
  component: () => (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Carregando…</div>}>
      <Page />
    </Suspense>
  ),
});
