import { createFileRoute, redirect } from "@tanstack/react-router";

/** Desafios consolidado no hub Social. */
export const Route = createFileRoute("/desafios")({
  beforeLoad: () => {
    throw redirect({ to: "/social", search: { tab: "desafios" } });
  },
});
