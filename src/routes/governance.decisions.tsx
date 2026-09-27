import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Page = lazy(() =>
  import("@/features/governance/decisions-page").then((m) => ({
    default: m.GovernanceDecisionsPage,
  })),
);

export const Route = createFileRoute("/governance/decisions")({
  component: () => (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Carregando…</div>}>
      <Page />
    </Suspense>
  ),
});
