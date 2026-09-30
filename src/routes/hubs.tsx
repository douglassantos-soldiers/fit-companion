import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for hub detail; list entry lives under Social (`/hubs/` redirects). */
export const Route = createFileRoute("/hubs")({
  component: HubsLayout,
});

function HubsLayout() {
  return <Outlet />;
}
