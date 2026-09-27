/**
 * Structured LLM output validation — fail-closed.
 * LLM never emits final Decision; only analysis + optional proposal shape.
 */

import type { SkillEvidenceItem } from "@/ai/contracts/skill-result";
import { makeAIError } from "@/ai/providers/errors";
import type { AIError } from "@/ai/providers/types";
import {
  makeSkillProposal,
  toDecisionProposalFromSkill,
} from "@/ai/skills/core/proposal";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";

export type LlmStructuredProposal = {
  proposed_type: string;
  proposed_value: string | number | boolean;
  reason_codes: string[];
  confidence: number;
};

export type LlmStructuredOutput = {
  analysis: unknown;
  evidence: SkillEvidenceItem[];
  confidence: number;
  proposal: LlmStructuredProposal | null;
};

export type ValidatedLlmOutput = {
  structured: LlmStructuredOutput;
  decision_proposal: DecisionProposal | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseEvidence(raw: unknown): SkillEvidenceItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SkillEvidenceItem[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    if (typeof item["signal"] !== "string") return null;
    if (item["value"] === undefined) return null;
    const ev: SkillEvidenceItem = {
      signal: item["signal"],
      value: item["value"] as string | number | boolean | null,
    };
    if (typeof item["source"] === "string") ev.source = item["source"];
    out.push(ev);
  }
  return out;
}

function parseProposal(raw: unknown): LlmStructuredProposal | null | "invalid" {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return "invalid";
  if (typeof raw["proposed_type"] !== "string" || !raw["proposed_type"].trim()) return "invalid";
  const pv = raw["proposed_value"];
  if (typeof pv !== "string" && typeof pv !== "number" && typeof pv !== "boolean") return "invalid";
  if (!Array.isArray(raw["reason_codes"])) return "invalid";
  const codes = raw["reason_codes"].filter((c): c is string => typeof c === "string");
  if (codes.length === 0) return "invalid";
  const conf = raw["confidence"];
  if (typeof conf !== "number" || Number.isNaN(conf) || conf < 0 || conf > 1) return "invalid";
  return {
    proposed_type: raw["proposed_type"].trim(),
    proposed_value: pv,
    reason_codes: codes.slice(0, 12),
    confidence: conf,
  };
}

/** Lightweight permission stub — always allow structured shape; Safety is separate. */
export function checkLlmPermissionStub(_agentId: string): { ok: true } | AIError {
  return { ok: true };
}

/** Safety hook stub — rejects obviously empty / toxic markers; never grants Decision. */
export function checkLlmSafetyHook(structured: LlmStructuredOutput): { ok: true } | AIError {
  if (structured.confidence < 0 || structured.confidence > 1) {
    return makeAIError("safety_rejection", "confidence_out_of_range");
  }
  const text = JSON.stringify(structured.analysis ?? "").toLowerCase();
  if (text.includes("__unsafe_override__") || text.includes("__bypass_safety__")) {
    return makeAIError("safety_rejection", "unsafe_marker_in_analysis");
  }
  return { ok: true };
}

export function parseStructuredOutput(text: string): LlmStructuredOutput | AIError {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return makeAIError("invalid_structured_output", "json_parse_failed");
  }
  if (!isRecord(parsed)) {
    return makeAIError("invalid_structured_output", "root_not_object");
  }
  if (!("analysis" in parsed)) {
    return makeAIError("invalid_structured_output", "missing_analysis");
  }
  const evidence = parseEvidence(parsed["evidence"]);
  if (!evidence) {
    return makeAIError("invalid_structured_output", "invalid_evidence");
  }
  const confidence = parsed["confidence"];
  if (typeof confidence !== "number" || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    return makeAIError("invalid_structured_output", "invalid_confidence");
  }
  const proposal = parseProposal(parsed["proposal"]);
  if (proposal === "invalid") {
    return makeAIError("invalid_structured_output", "invalid_proposal");
  }
  return {
    analysis: parsed["analysis"],
    evidence,
    confidence,
    proposal,
  };
}

export function validateAndBridgeStructured(opts: {
  text: string;
  agentId: string;
  userId: string;
  skillId?: string;
}): ValidatedLlmOutput | AIError {
  const perm = checkLlmPermissionStub(opts.agentId);
  if (!perm.ok) return perm;

  const structured = parseStructuredOutput(opts.text);
  if (!("analysis" in structured)) return structured;

  const safety = checkLlmSafetyHook(structured);
  if (!safety.ok) return safety;

  let decision_proposal: DecisionProposal | null = null;
  if (structured.proposal) {
    const skillProposal = makeSkillProposal({
      skillId: opts.skillId ?? `llm:${opts.agentId}`,
      userId: opts.userId,
      proposedType: structured.proposal.proposed_type,
      proposedValue: structured.proposal.proposed_value,
      reasonCodes: structured.proposal.reason_codes,
      confidence: structured.proposal.confidence,
    });
    decision_proposal = toDecisionProposalFromSkill(skillProposal);
  }

  return { structured, decision_proposal };
}
