import { createFileRoute } from "@tanstack/react-router";
import { lazyGovernancePage } from "@/features/governance/lazy-page";

export const Route = createFileRoute("/governance/safety")({
  component: lazyGovernancePage(
    () => import("@/features/governance/safety-page"),
    "GovernanceSafetyPage",
  ),
});
