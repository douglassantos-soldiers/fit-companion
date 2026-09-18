import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const AdminPage = lazy(() =>
  import("@/features/admin-page").then((m) => ({ default: m.AdminPage })),
);

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin CMS — Soldiers" },
      { name: "description", content: "Gerencie mídia de treinos, vídeos e imagens dos presets." },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          Carregando admin…
        </div>
      }
    >
      <AdminPage />
    </Suspense>
  );
}
