/**
 * Governance Console navigation (FASE 19) — read-only observability.
 */

export const GOVERNANCE_NAV = [
  { id: "overview", path: "/governance/overview", label: "Overview" },
  { id: "agents", path: "/governance/agents", label: "Agents" },
  { id: "runs", path: "/governance/runs", label: "Runs" },
  { id: "decisions", path: "/governance/decisions", label: "Decisions" },
  { id: "safety", path: "/governance/safety", label: "Safety" },
  { id: "rag", path: "/governance/rag", label: "RAG" },
  { id: "cost", path: "/governance/cost", label: "Cost" },
  { id: "evaluation", path: "/governance/evaluation", label: "Evaluation" },
] as const;

export type GovernanceNavId = (typeof GOVERNANCE_NAV)[number]["id"];
