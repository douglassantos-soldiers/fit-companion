import { createFileRoute, redirect } from "@tanstack/react-router";

/** Hub list consolidated under Social tab — detail stays at /hubs/$slug. */
export const Route = createFileRoute("/hubs/")({
  beforeLoad: () => {
    throw redirect({ to: "/social", search: { tab: "hubs" } });
  },
});
