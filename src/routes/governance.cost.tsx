import { createFileRoute } from "@tanstack/react-router";
import { lazyGovernancePage } from "@/features/governance/lazy-page";

export const Route = createFileRoute("/governance/cost")({
  component: lazyGovernancePage(
    () => import("@/features/governance/cost-page"),
    "GovernanceCostPage",
  ),
});
