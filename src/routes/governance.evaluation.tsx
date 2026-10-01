import { createFileRoute } from "@tanstack/react-router";
import { lazyGovernancePage } from "@/features/governance/lazy-page";

export const Route = createFileRoute("/governance/evaluation")({
  component: lazyGovernancePage(
    () => import("@/features/governance/evaluation-page"),
    "GovernanceEvaluationPage",
  ),
});
