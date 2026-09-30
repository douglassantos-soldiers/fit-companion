import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { parseAdminSearch } from "@/features/admin/admin-search";

const AdminPage = lazy(() =>
  import("@/features/admin-page").then((m) => ({ default: m.AdminPage })),
);

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => parseAdminSearch(search),
  head: () => ({
    meta: [
      { title: "Admin Console — Soldiers" },
      {
        name: "description",
        content: "Console operacional: CMS remoto, acesso Shopify e saúde do sistema.",
      },
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
