import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/social")({
  component: SocialLayout,
});

function SocialLayout() {
  return <Outlet />;
}
