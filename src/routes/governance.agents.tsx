import { createFileRoute } from "@tanstack/react-router";
import { lazyGovernancePage } from "@/features/governance/lazy-page";

export const Route = createFileRoute("/governance/agents")({
  component: lazyGovernancePage(
    () => import("@/features/governance/agents-page"),
    "GovernanceAgentsPage",
  ),
});
