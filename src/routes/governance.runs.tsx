import { createFileRoute } from "@tanstack/react-router";
import { lazyGovernancePage } from "@/features/governance/lazy-page";

export const Route = createFileRoute("/governance/runs")({
  component: lazyGovernancePage(
    () => import("@/features/governance/runs-page"),
    "GovernanceRunsPage",
  ),
});
