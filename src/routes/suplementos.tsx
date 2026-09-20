import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/suplementos")({
  beforeLoad: () => {
    throw redirect({ to: "/nutricao", search: { tab: "doses" } });
  },
  component: () => null,
});
