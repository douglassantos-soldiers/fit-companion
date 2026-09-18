import { createFileRoute, redirect } from "@tanstack/react-router";

/** Clubes consolidado no hub Social. */
export const Route = createFileRoute("/clubes")({
  beforeLoad: () => {
    throw redirect({ to: "/social", search: { tab: "clubes" } });
  },
});
