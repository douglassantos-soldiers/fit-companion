import { createFileRoute, redirect } from "@tanstack/react-router";

/** List entry consolidated under Social tab — detail stays at /hubs/$slug. */
export const Route = createFileRoute("/hubs")({
  beforeLoad: () => {
    throw redirect({ to: "/social", search: { tab: "hubs" } });
  },
});
