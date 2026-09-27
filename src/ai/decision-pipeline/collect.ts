/**
 * Collect DecisionProposals from specialist AgentAnalysisResults.
 */

import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import {
  attachProposalEvidence,
  isLowProposalConfidence,
  isMissingEvidence,
} from "@/ai/decision-pipeline/evidence";

export type CollectedProposal = {
  proposal: DecisionProposal;
  agent_id: string;
  discarded_reason?: string;
};

export type CollectProposalsResult = {
  candidates: CollectedProposal[];
  discarded: CollectedProposal[];
};

export function collectProposalsFromSpecialists(
  results: AgentAnalysisResult[],
  opts?: {
    minEvidenceConfidence?: number;
    minProposalConfidence?: number;
  },
): CollectProposalsResult {
  const minEv = opts?.minEvidenceConfidence ?? 0.25;
  const minConf = opts?.minProposalConfidence ?? 0.35;
  const candidates: CollectedProposal[] = [];
  const discarded: CollectedProposal[] = [];

  for (const r of results) {
    if (!r.proposal) continue;
    let proposal: DecisionProposal = {
      ...r.proposal,
      agent_id: r.proposal.agent_id ?? r.agent_id,
    };

    // Attach evidence from agent result layers
    const toolEv = r.evidence.filter(
      (e) =>
        e.source &&
        !String(e.source).startsWith("memory") &&
        !String(e.signal).startsWith("memory:"),
    );
    const memEv = r.evidence.filter(
      (e) => String(e.source) === "memory" || String(e.signal).startsWith("memory:"),
    );
    proposal = attachProposalEvidence({
      proposal,
      toolEvidence: toolEv,
      memoryEvidence: memEv,
      memoryIds: r.memory_ids,
      ragCitations: r.citations,
      contextSignals: r.evidence.filter((e) => e.source === "context"),
      modelConfidence: proposal.confidence_breakdown?.model_confidence,
    });

    const entry: CollectedProposal = { proposal, agent_id: proposal.agent_id ?? r.agent_id };

    if (isMissingEvidence(proposal, minEv)) {
      discarded.push({ ...entry, discarded_reason: "missing_evidence" });
      continue;
    }
    if (isLowProposalConfidence(proposal, minConf)) {
      discarded.push({ ...entry, discarded_reason: "low_confidence" });
      continue;
    }
    candidates.push(entry);
  }

  return { candidates, discarded };
}
