/**
 * AI-layer surface for DecisionProposal.
 * Agents/Coach emit proposals; only the Decision Engine emits Decision.
 */
export type {
  DecisionProposal,
  DecisionProposalSource,
  ResolveProposalResult,
} from "@/lib/engine/decision-proposal";
export {
  buildProposalId,
  parseDecisionProposal,
  resolveProposalAgainstEngine,
  toDecisionProposal,
  validateProposalAgainstSafety,
  validateProposalContext,
} from "@/lib/engine/decision-proposal";
