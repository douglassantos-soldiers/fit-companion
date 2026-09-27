/**
 * Deterministic priority resolution — never max-confidence alone.
 *
 * Order: Safety → Recovery → Training → Nutrition → Behavior → Performance
 * Tie-break: evidence_confidence, then alignment with snapshot trainingMode.
 */

import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { CollectedProposal } from "@/ai/decision-pipeline/collect";
import { domainOf } from "@/ai/decision-pipeline/conflicts";

const DOMAIN_RANK: Record<string, number> = {
  safety: 0,
  recovery: 1,
  training: 2,
  nutrition: 3,
  behavior: 4,
  performance: 5,
  unknown: 6,
};

function rankOf(p: DecisionProposal): number {
  if (
    p.proposed_type === "REST" ||
    p.proposed_type === "SLEEP_FOCUS" ||
    p.proposed_type === "INCREASE_RECOVERY"
  ) {
    return DOMAIN_RANK.recovery ?? 1;
  }
  return DOMAIN_RANK[domainOf(p)] ?? 6;
}

function alignsWithMode(p: DecisionProposal, mode: string): boolean {
  const v = p.proposed_value;
  if (typeof v === "string" && ["full", "express", "deload", "rest"].includes(v)) {
    return v === mode;
  }
  if (p.proposed_type === "FULL_WORKOUT") return mode === "full";
  if (p.proposed_type === "EXPRESS_WORKOUT") return mode === "express";
  if (p.proposed_type === "DELOAD") return mode === "deload";
  if (p.proposed_type === "REST") return mode === "rest";
  return true; // non-mode proposals (nutrition, checkin) don't misalign
}

export function compareProposalPriority(
  a: DecisionProposal,
  b: DecisionProposal,
  snapshot?: DecisionContextSnapshot | null,
): number {
  const ra = rankOf(a);
  const rb = rankOf(b);
  if (ra !== rb) return ra - rb;

  const ea = a.confidence_breakdown?.evidence_confidence ?? 0;
  const eb = b.confidence_breakdown?.evidence_confidence ?? 0;
  if (ea !== eb) return eb - ea;

  if (snapshot) {
    const aa = alignsWithMode(a, snapshot.decisions.trainingMode) ? 1 : 0;
    const ab = alignsWithMode(b, snapshot.decisions.trainingMode) ? 1 : 0;
    if (aa !== ab) return ab - aa;
  }

  // Last resort: proposal_confidence (not model_confidence)
  const ca = a.confidence_breakdown?.proposal_confidence ?? a.confidence;
  const cb = b.confidence_breakdown?.proposal_confidence ?? b.confidence;
  return cb - ca;
}

export function selectByPriority(
  candidates: CollectedProposal[],
  snapshot?: DecisionContextSnapshot | null,
): { selected: CollectedProposal | null; ordered: CollectedProposal[]; resolution_reason: string } {
  if (candidates.length === 0) {
    return { selected: null, ordered: [], resolution_reason: "no_candidates" };
  }
  const ordered = [...candidates].sort((x, y) =>
    compareProposalPriority(x.proposal, y.proposal, snapshot),
  );
  const selected = ordered[0]!;
  const resolution_reason = `priority_domain=${domainOf(selected.proposal)};rank=${rankOf(selected.proposal)};agent=${selected.agent_id}`;
  return { selected, ordered, resolution_reason };
}
