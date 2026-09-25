/**
 * FactPack — structured facts only (no invented claims).
 */

import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";
import type { DecisionProposal } from "@/ai/contracts/proposal";
import type { SkillEvidenceItem } from "@/ai/contracts/skill-result";
import type { CoachAgentIntentKind } from "@/ai/agents/coach/intent";

export type WhyFacts = {
  reason_codes: string[];
  reason_aliases: string[];
  explanations: string[];
  training_mode: string | null;
  decision_value: string | number | boolean | null;
  expected_outcome: unknown;
  evidence_items: SkillEvidenceItem[];
  outcome_summary: unknown;
};

export type CoachFactPack = {
  intentKind: CoachAgentIntentKind;
  message: string;
  specialistResults: AgentAnalysisResult[];
  evidence: SkillEvidenceItem[];
  confidence: number;
  warnings: string[];
  why: WhyFacts | null;
  proposal: DecisionProposal | null;
  proposalStatus: "none" | "accepted" | "rejected" | "safety_blocked";
  proposalRejectReason?: string;
  citationsCount: number;
  memoryCount: number;
};

export function emptyWhyFacts(): WhyFacts {
  return {
    reason_codes: [],
    reason_aliases: [],
    explanations: [],
    training_mode: null,
    decision_value: null,
    expected_outcome: null,
    evidence_items: [],
    outcome_summary: null,
  };
}

export function buildFactPack(opts: {
  intentKind: CoachAgentIntentKind;
  message: string;
  specialistResults: AgentAnalysisResult[];
  why: WhyFacts | null;
  proposal: DecisionProposal | null;
  proposalStatus: CoachFactPack["proposalStatus"];
  proposalRejectReason?: string;
}): CoachFactPack {
  const evidence: SkillEvidenceItem[] = [];
  const warnings: string[] = [];
  let confSum = 0;
  let confN = 0;
  let citationsCount = 0;
  let memoryCount = 0;

  for (const r of opts.specialistResults) {
    evidence.push(...r.evidence);
    warnings.push(...r.warnings);
    confSum += r.confidence;
    confN += 1;
    citationsCount += r.citations?.length ?? 0;
    memoryCount += r.memory_ids?.length ?? 0;
    if (r.status !== "completed") warnings.push(`specialist_${r.status}:${r.agent_id}`);
  }

  if (opts.why) {
    evidence.push(...opts.why.evidence_items);
  }

  const pack: CoachFactPack = {
    intentKind: opts.intentKind,
    message: opts.message,
    specialistResults: opts.specialistResults,
    evidence,
    confidence: confN ? confSum / confN : 0.4,
    warnings,
    why: opts.why,
    proposal: opts.proposal,
    proposalStatus: opts.proposalStatus,
    citationsCount,
    memoryCount,
  };
  if (opts.proposalRejectReason) pack.proposalRejectReason = opts.proposalRejectReason;
  return pack;
}
