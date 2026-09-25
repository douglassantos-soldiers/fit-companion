/**
 * Aggregate skill/tool/RAG/memory outputs into AgentAnalysisResult fields.
 */

import type { KnowledgeCitation } from "@/ai/contracts/knowledge-citation";
import type { DecisionProposal } from "@/ai/contracts/proposal";
import type { SkillEvidenceItem, SkillProposal } from "@/ai/contracts/skill-result";
import { toDecisionProposalFromSkill } from "@/ai/skills/core/proposal";

export type SkillPartial = {
  skillId: string;
  result: unknown;
  evidence: SkillEvidenceItem[];
  confidence: number;
  warnings: string[];
  proposal?: SkillProposal | null;
  skill_run_id?: string;
};

export function aggregateSpecialistOutputs(opts: {
  agentId: string;
  skillPartials: SkillPartial[];
  toolSummaries: Array<{ toolId: string; ok: boolean; tool_call_id?: string }>;
  citations: KnowledgeCitation[];
  memoryIds: string[];
  memoryEvidence: SkillEvidenceItem[];
}): {
  analysis: unknown;
  evidence: SkillEvidenceItem[];
  confidence: number;
  proposal: DecisionProposal | null;
  warnings: string[];
  skill_run_ids: string[];
  tool_call_ids: string[];
} {
  const evidence: SkillEvidenceItem[] = [...opts.memoryEvidence];
  const warnings: string[] = [];
  const skill_run_ids: string[] = [];
  const tool_call_ids: string[] = [];
  const analyses: Array<{ skillId: string; result: unknown }> = [];
  let bestProposal: SkillProposal | null = null;

  for (const p of opts.skillPartials) {
    analyses.push({ skillId: p.skillId, result: p.result });
    evidence.push(...p.evidence);
    warnings.push(...p.warnings);
    if (p.skill_run_id) skill_run_ids.push(p.skill_run_id);
    if (p.proposal && (!bestProposal || p.proposal.confidence > bestProposal.confidence)) {
      bestProposal = p.proposal;
    }
  }

  for (const t of opts.toolSummaries) {
    if (t.tool_call_id) tool_call_ids.push(t.tool_call_id);
    if (!t.ok) warnings.push(`tool_failed:${t.toolId}`);
  }

  const confidences = opts.skillPartials.map((p) => p.confidence);
  const confidence =
    confidences.length === 0 ? 0.4 : confidences.reduce((a, b) => a + b, 0) / confidences.length;

  const proposal = bestProposal ? toDecisionProposalFromSkill(bestProposal) : null;

  return {
    analysis: {
      agent_id: opts.agentId,
      skills: analyses,
      citation_count: opts.citations.length,
      memory_count: opts.memoryIds.length,
    },
    evidence,
    confidence: Math.max(0, Math.min(1, confidence)),
    proposal,
    warnings,
    skill_run_ids,
    tool_call_ids,
  };
}
