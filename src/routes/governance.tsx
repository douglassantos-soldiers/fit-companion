import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/governance")({
  head: () => ({
    meta: [
      { title: "AI Governance — Soldiers" },
      {
        name: "description",
        content: "Console de observabilidade AI (admin/analyst, somente leitura).",
      },
    ],
  }),
  component: GovernanceLayout,
});

function GovernanceLayout() {
  return <Outlet />;
}
