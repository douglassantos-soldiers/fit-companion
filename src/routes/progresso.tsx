import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AppShell } from "@/components/app-shell";

const ProgressPage = lazy(() =>
  import("@/features/progresso-page").then((m) => ({ default: m.ProgressPage })),
);

export const Route = createFileRoute("/progresso")({
  head: () => ({
    meta: [
      { title: "Progresso — Soldiers Performance OS" },
      {
        name: "description",
        content: "Volume, carga por exercício, heatmap, PRs e comparativo semanal.",
      },
      { property: "og:title", content: "Seu progresso" },
      { property: "og:description", content: "Progresso estilo Fitbod / Strava." },
    ],
  }),
  component: ProgressoRoute,
});

function ProgressoRoute() {
  return (
    <Suspense
      fallback={
        <AppShell title="Progresso">
          <div className="surface-glass h-40 animate-pulse" />
        </AppShell>
      }
    >
      <ProgressPage />
    </Suspense>
  );
}
