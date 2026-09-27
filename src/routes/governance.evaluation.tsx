import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Page = lazy(() =>
  import("@/features/governance/evaluation-page").then((m) => ({
    default: m.GovernanceEvaluationPage,
  })),
);

export const Route = createFileRoute("/governance/evaluation")({
  component: () => (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Carregando…</div>}>
      <Page />
    </Suspense>
  ),
});
