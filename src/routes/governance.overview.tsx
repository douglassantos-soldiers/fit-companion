import { createFileRoute } from "@tanstack/react-router";
import { lazyGovernancePage } from "@/features/governance/lazy-page";

export const Route = createFileRoute("/governance/overview")({
  component: lazyGovernancePage(
    () => import("@/features/governance/overview-page"),
    "GovernanceOverviewPage",
  ),
});
