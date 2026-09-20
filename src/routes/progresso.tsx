import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/progresso")({
  component: ProgressoLayout,
});

function ProgressoLayout() {
  return <Outlet />;
}
