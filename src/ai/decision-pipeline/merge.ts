/**
 * Merge collected proposals: conflict detect → priority → selected.
 */

import { recordAudit } from "@/ai/governance/audit";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import type { SafetyVerdict } from "@/lib/engine/safety";
import {
  collectProposalsFromSpecialists,
  type CollectedProposal,
  type CollectProposalsResult,
} from "@/ai/decision-pipeline/collect";
import {
  detectProposalConflicts,
  type ProposalConflict,
} from "@/ai/decision-pipeline/conflicts";
import { selectByPriority } from "@/ai/decision-pipeline/priority";
import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";

export type MergeProposalsResult = {
  selected: DecisionProposal | null;
  discarded: CollectedProposal[];
  conflicts: ProposalConflict[];
  resolution_reason: string;
  candidates: CollectedProposal[];
};

export function mergeSpecialistProposals(opts: {
  specialistResults: AgentAnalysisResult[];
  snapshot?: DecisionContextSnapshot | null;
  safety?: SafetyVerdict | null;
  userId?: string;
  runId?: string;
}): MergeProposalsResult {
  const collected: CollectProposalsResult = collectProposalsFromSpecialists(
    opts.specialistResults,
  );
  const safety = opts.safety ?? opts.snapshot?.safety ?? null;
  const conflicts = detectProposalConflicts(collected.candidates, safety);
  const { selected, resolution_reason } = selectByPriority(
    collected.candidates,
    opts.snapshot ?? null,
  );

  // If selected conflicts with safety escalate, drop it
  let finalSelected = selected;
  let reason = resolution_reason;
  if (finalSelected && safety?.escalateCare) {
    const p = finalSelected.proposal;
    const restAligned =
      p.proposed_type === "REST" ||
      p.proposed_type === "INCREASE_RECOVERY" ||
      p.proposed_type === "SLEEP_FOCUS" ||
      p.proposed_value === "rest" ||
      p.proposed_value === "sleep";
    if (!restAligned) {
      collected.discarded.push({
        ...finalSelected,
        discarded_reason: "behavior_vs_safety",
      });
      // Prefer any rest-aligned candidate
      const restCand = collected.candidates.find((c) => {
        const t = c.proposal.proposed_type;
        return (
          t === "REST" ||
          t === "INCREASE_RECOVERY" ||
          t === "SLEEP_FOCUS" ||
          c.proposal.proposed_value === "rest"
        );
      });
      finalSelected = restCand ?? null;
      reason = restCand
        ? `safety_override_rest;${restCand.agent_id}`
        : "safety_escalate_no_rest_candidate";
    }
  }

  const discarded = [
    ...collected.discarded,
    ...collected.candidates.filter(
      (c) =>
        finalSelected &&
        c.proposal.proposal_id !== finalSelected.proposal.proposal_id,
    ).map((c) => ({ ...c, discarded_reason: c.discarded_reason ?? "lower_priority" })),
  ];

  recordAudit({
    kind: "proposal_merge",
    user_id: opts.userId ?? finalSelected?.proposal.user_id ?? "system",
    subject_id: opts.runId ?? finalSelected?.proposal.proposal_id ?? `merge_${Date.now()}`,
    ...(opts.runId ? { run_id: opts.runId } : {}),
    status: finalSelected ? "selected" : "none",
    summary: reason.slice(0, 240),
    metadata: {
      candidate_count: collected.candidates.length,
      discarded_count: discarded.length,
      conflict_count: conflicts.length,
      ...(finalSelected
        ? {
            selected_type: finalSelected.proposal.proposed_type,
            selected_agent: finalSelected.agent_id,
          }
        : {}),
      ...(conflicts[0]
        ? {
            conflict_type: conflicts[0].conflict_type,
            conflict_detail: conflicts[0].detail.slice(0, 120),
          }
        : {}),
      resolution_reason: reason.slice(0, 160),
    },
  });

  return {
    selected: finalSelected?.proposal ?? null,
    discarded,
    conflicts,
    resolution_reason: reason,
    candidates: collected.candidates,
  };
}
