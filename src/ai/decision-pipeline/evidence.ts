/**
 * FASE 18 — attach context/tool/RAG/memory evidence to DecisionProposal.
 * Never invents signals; only records what was actually available.
 */

import type { KnowledgeCitation } from "@/ai/contracts/knowledge-citation";
import type { SkillEvidenceItem } from "@/ai/contracts/skill-result";
import type {
  DecisionProposal,
  ProposalConfidenceBreakdown,
} from "@/lib/engine/decision-proposal";
import type { DecisionEvidence, DecisionEvidenceItem } from "@/lib/engine/decision-evidence";

export type AttachProposalEvidenceInput = {
  proposal: DecisionProposal;
  contextSignals?: SkillEvidenceItem[];
  toolEvidence?: SkillEvidenceItem[];
  ragCitations?: KnowledgeCitation[];
  memoryEvidence?: SkillEvidenceItem[];
  memoryIds?: string[];
  /** LLM/gateway confidence — stored separately, never becomes Decision.confidence */
  modelConfidence?: number;
  observedAt?: string;
};

function toItem(
  signal: string,
  value: string | number | boolean | null,
  source: string,
  observedAt: string,
  relevance: DecisionEvidenceItem["relevance"] = "medium",
  confidence = 0.7,
): DecisionEvidenceItem {
  return { signal, value, source, observedAt, relevance, confidence };
}

/**
 * Compute evidence_confidence from coverage of four evidence families (0..1).
 */
export function computeEvidenceConfidence(opts: {
  hasContext: boolean;
  hasTools: boolean;
  hasRag: boolean;
  hasMemory: boolean;
}): number {
  let n = 0;
  if (opts.hasContext) n += 1;
  if (opts.hasTools) n += 1;
  if (opts.hasRag) n += 1;
  if (opts.hasMemory) n += 1;
  if (n === 0) return 0;
  return Math.round((n / 4) * 100) / 100;
}

export function attachProposalEvidence(input: AttachProposalEvidenceInput): DecisionProposal {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const items: DecisionEvidenceItem[] = [];
  const metrics: DecisionEvidence["metrics"] = {
    ...(input.proposal.evidence?.metrics ?? {}),
  };

  const ctx = input.contextSignals ?? [];
  for (const e of ctx.slice(0, 12)) {
    items.push(
      toItem(
        `context:${e.signal}`,
        e.value,
        e.source ?? "context",
        observedAt,
        "high",
        0.75,
      ),
    );
  }

  const tools = input.toolEvidence ?? [];
  for (const e of tools.slice(0, 16)) {
    items.push(
      toItem(e.signal, e.value, e.source ?? "tool", observedAt, "high", 0.8),
    );
    if (typeof e.value === "number" || typeof e.value === "boolean") {
      metrics[e.signal] = e.value;
    } else if (typeof e.value === "string") {
      metrics[e.signal] = e.value;
    }
  }

  const cites = input.ragCitations ?? [];
  for (const c of cites.slice(0, 6)) {
    items.push(
      toItem(
        `rag:${c.document_id}`,
        c.score,
        c.source_id ?? c.title,
        observedAt,
        c.score >= 0.6 ? "high" : "medium",
        Math.max(0, Math.min(1, c.score)),
      ),
    );
  }
  if (cites.length) metrics["rag_citation_count"] = cites.length;

  const mem = input.memoryEvidence ?? [];
  for (const e of mem.slice(0, 8)) {
    items.push(
      toItem(
        e.signal.startsWith("memory:") ? e.signal : `memory:${e.signal}`,
        e.value,
        e.source ?? "memory",
        observedAt,
        "medium",
        0.65,
      ),
    );
  }
  if (input.memoryIds?.length) metrics["memory_count"] = input.memoryIds.length;

  const evidence_confidence = computeEvidenceConfidence({
    hasContext: ctx.length > 0,
    hasTools: tools.length > 0,
    hasRag: cites.length > 0,
    hasMemory: mem.length > 0 || Boolean(input.memoryIds?.length),
  });

  const breakdown: ProposalConfidenceBreakdown = {
    ...(input.proposal.confidence_breakdown ?? {}),
    proposal_confidence:
      input.proposal.confidence_breakdown?.proposal_confidence ?? input.proposal.confidence,
    evidence_confidence,
  };
  if (input.modelConfidence != null) {
    breakdown.model_confidence = Math.max(0, Math.min(1, input.modelConfidence));
  }

  const evidence: DecisionEvidence = {
    metrics,
    items: [...(input.proposal.evidence?.items ?? []), ...items].slice(0, 40),
  };
  if (input.proposal.evidence?.notes?.length) {
    evidence.notes = input.proposal.evidence.notes;
  }

  return {
    ...input.proposal,
    evidence,
    confidence_breakdown: breakdown,
    // Keep proposal.confidence as proposal score — never replace with model_confidence
    confidence: breakdown.proposal_confidence ?? input.proposal.confidence,
  };
}

/** True when evidence coverage is too thin to promote a proposal. */
export function isMissingEvidence(proposal: DecisionProposal, minEvidenceConfidence = 0.25): boolean {
  const ec = proposal.confidence_breakdown?.evidence_confidence;
  if (ec == null) {
    const items = proposal.evidence?.items?.length ?? 0;
    const metrics = Object.keys(proposal.evidence?.metrics ?? {}).length;
    return items === 0 && metrics === 0;
  }
  return ec < minEvidenceConfidence;
}

export function isLowProposalConfidence(proposal: DecisionProposal, min = 0.35): boolean {
  return proposal.confidence < min;
}
