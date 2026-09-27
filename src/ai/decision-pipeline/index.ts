/**
 * FASE 18 — Specialist proposals → merge → Decision Engine (existing).
 */

export {
  attachProposalEvidence,
  computeEvidenceConfidence,
  isMissingEvidence,
  isLowProposalConfidence,
} from "@/ai/decision-pipeline/evidence";
export {
  collectProposalsFromSpecialists,
  type CollectedProposal,
  type CollectProposalsResult,
} from "@/ai/decision-pipeline/collect";
export {
  detectProposalConflicts,
  domainOf,
  type ProposalConflict,
  type ProposalConflictType,
} from "@/ai/decision-pipeline/conflicts";
export {
  compareProposalPriority,
  selectByPriority,
} from "@/ai/decision-pipeline/priority";
export {
  mergeSpecialistProposals,
  type MergeProposalsResult,
} from "@/ai/decision-pipeline/merge";
export {
  runSpecialistsDecisionPipeline,
  type RunSpecialistsDecisionPipelineInput,
  type RunSpecialistsDecisionPipelineResult,
} from "@/ai/decision-pipeline/run-pipeline";
