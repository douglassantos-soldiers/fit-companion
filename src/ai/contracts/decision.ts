/**
 * AI-layer surface for Decision.
 * Source of truth remains in the deterministic Decision Engine contract.
 * CamelCase DecisionView is for Coach / Agents narrating WHY/WHAT/EXPECTED — not inventing rules.
 */
export type {
  Decision,
  DecisionAction,
  DecisionExpectedOutcome,
  DecisionStatus,
  DecisionView,
  DecisionWhat,
  DecisionWhy,
} from "@/lib/engine/decision-contract";
export {
  DECISION_CONTRACT_VERSION,
  buildDecisionId,
  canonicalDecisionType,
  decisionsFromBundle,
  engineDecisionToContract,
  evidenceForDecision,
  expectedOutcomeForDecision,
  selectWhyPanel,
  toDecisionView,
} from "@/lib/engine/decision-contract";
