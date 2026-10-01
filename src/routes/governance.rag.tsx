import { createFileRoute } from "@tanstack/react-router";
import { lazyGovernancePage } from "@/features/governance/lazy-page";

export const Route = createFileRoute("/governance/rag")({
  component: lazyGovernancePage(
    () => import("@/features/governance/rag-page"),
    "GovernanceRagPage",
  ),
});
