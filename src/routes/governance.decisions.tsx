import { createFileRoute } from "@tanstack/react-router";
import { lazyGovernancePage } from "@/features/governance/lazy-page";

export const Route = createFileRoute("/governance/decisions")({
  component: lazyGovernancePage(
    () => import("@/features/governance/decisions-page"),
    "GovernanceDecisionsPage",
  ),
});
