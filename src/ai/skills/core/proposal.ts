/**
 * Skills Framework — SkillProposal helpers + DecisionProposal bridge.
 */
import type { SkillProposal } from "@/ai/contracts/skill-result";
import type { TrustedUserId } from "@/ai/contracts/trusted-user-id";
import { buildProposalId, type DecisionProposal } from "@/lib/engine/decision-proposal";
import { canonicalReasonCode } from "@/lib/engine/reason-codes";

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) + h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

export function buildSkillProposalId(parts: {
  skillId: string;
  userId: string;
  proposedType: string;
  createdAt: string;
}): string {
  return `sp_${djb2([parts.skillId, parts.userId, parts.proposedType, parts.createdAt].join("|"))}`;
}

export function makeSkillProposal(opts: {
  skillId: string;
  userId: TrustedUserId | string;
  proposedType: string;
  proposedValue: string | number | boolean;
  reasonCodes: string[];
  confidence: number;
  contextId?: string;
  note?: string;
}): SkillProposal {
  const created_at = new Date().toISOString();
  const proposal: SkillProposal = {
    proposal_id: buildSkillProposalId({
      skillId: opts.skillId,
      userId: String(opts.userId),
      proposedType: opts.proposedType,
      createdAt: created_at,
    }),
    skill_id: opts.skillId,
    user_id: String(opts.userId),
    proposed_type: opts.proposedType,
    proposed_value: opts.proposedValue,
    reason_codes: [...new Set(opts.reasonCodes)].slice(0, 12),
    confidence: Math.max(0, Math.min(1, opts.confidence)),
    created_at,
  };
  if (opts.contextId) proposal.context_id = opts.contextId;
  if (opts.note) proposal.note = opts.note;
  return proposal;
}

/** Bridge SkillProposal → DecisionProposal (engine still decides). */
export function toDecisionProposalFromSkill(sp: SkillProposal): DecisionProposal {
  const created_at = sp.created_at;
  const proposal_id =
    sp.proposal_id ||
    buildProposalId({
      userId: sp.user_id,
      proposedType: sp.proposed_type,
      proposedValue: sp.proposed_value,
      createdAt: created_at,
    });
  const out: DecisionProposal = {
    proposal_id,
    user_id: sp.user_id,
    proposed_type: sp.proposed_type,
    proposed_value: sp.proposed_value,
    reason_codes: sp.reason_codes.map((c) => canonicalReasonCode(c)),
    confidence: sp.confidence,
    source: "agent",
    created_at,
  };
  if (sp.context_id) out.context_id = sp.context_id;
  return out;
}
