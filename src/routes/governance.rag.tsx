import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Page = lazy(() =>
  import("@/features/governance/rag-page").then((m) => ({ default: m.GovernanceRagPage })),
);

export const Route = createFileRoute("/governance/rag")({
  component: () => (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Carregando…</div>}>
      <Page />
    </Suspense>
  ),
});
