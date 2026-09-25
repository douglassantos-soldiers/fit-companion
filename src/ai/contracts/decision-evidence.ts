/**
 * AI-layer surface for DecisionEvidence.
 * Source of truth remains in the Decision Engine evidence helpers.
 */
export type { DecisionEvidence, DecisionEvidenceItem } from "@/lib/engine/decision-evidence";
export {
  emptyEvidence,
  evidenceFromMetrics,
  evidenceFromSnapshotLike,
  evidenceItemsFromContext,
  mergeEvidence,
} from "@/lib/engine/decision-evidence";
