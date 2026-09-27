/**
 * Agent quality — deterministic checks on reasoning / evidence / proposal / tools.
 * Does not call or mutate Decision Engine.
 */
import type { EvalArtifact, GoldenCase } from "@/ai/governance/eval/golden/types";
import { scoreEvidenceForGolden } from "@/ai/governance/eval/evidence-quality";

export type AgentQualityResult = {
  passed: boolean;
  score: number;
  notes: string[];
  dimensions: {
    reasoning_output: boolean;
    evidence_selection: boolean;
    proposal_validity: boolean;
    confidence_calibration: boolean;
    tool_selection: boolean;
  };
};

export function evaluateAgentQuality(
  golden: GoldenCase,
  artifact: EvalArtifact,
): AgentQualityResult {
  const notes: string[] = [];
  const isNegative = (golden.tags ?? []).includes("negative");

  // Reasoning output: required fields present when contract demands WHY/WHAT/EXPECTED
  const requiredReasoning = ["why", "what", "expected"];
  const fields = new Set(artifact.reasoning_fields ?? []);
  let reasoning_output = true;
  if (golden.expected_decision_characteristics.must_have_why_what_expected) {
    reasoning_output = requiredReasoning.every((f) => fields.has(f));
    if (!reasoning_output) notes.push("reasoning_fields_incomplete");
  }

  // Evidence selection ⊆ pack / expected citations
  const allowedIds = new Set([
    ...(golden.expected_evidence.citation_ids ?? []),
    ...(artifact.evidence_pack ?? []).map((e) => e.id),
  ]);
  let evidence_selection = true;
  for (const c of artifact.citations ?? []) {
    if (c.citation_id && allowedIds.size > 0 && !allowedIds.has(c.citation_id)) {
      evidence_selection = false;
      notes.push(`evidence_selection_outside_pack:${c.citation_id}`);
    }
  }
  const ev = scoreEvidenceForGolden(golden, artifact);
  if (!ev.passed && !isNegative) {
    evidence_selection = false;
  }

  // Proposal validity
  let proposal_validity = artifact.proposal_valid !== false;
  if (artifact.proposal_rejected === true) proposal_validity = false;
  const expectedType = golden.expected_proposal["decision_type"];
  if (
    typeof expectedType === "string" &&
    artifact.proposal &&
    typeof artifact.proposal["decision_type"] === "string" &&
    artifact.proposal["decision_type"] !== expectedType &&
    !(golden.expected_decision_characteristics.allowed_decision_types ?? []).includes(
      String(artifact.proposal["decision_type"]),
    )
  ) {
    proposal_validity = false;
    notes.push("proposal_type_mismatch");
  }
  if (isNegative && artifact.proposal_valid === false) {
    // negative fixture correctly marks invalid
    proposal_validity = false;
  }

  // Confidence calibration: high confidence + weak evidence = fail
  let confidence_calibration = true;
  const conf = artifact.confidence ?? 0;
  if (conf >= 0.85 && ev.evidence_quality < 0.5) {
    confidence_calibration = false;
    notes.push("confidence_overcalibrated");
  }

  // Tool selection ⊆ allowlist
  let tool_selection = true;
  const allowed = new Set(artifact.allowed_tools ?? []);
  if (allowed.size > 0) {
    for (const t of artifact.tools_used ?? []) {
      if (!allowed.has(t)) {
        tool_selection = false;
        notes.push(`unauthorized_tool:${t}`);
      }
    }
  }

  const dims = {
    reasoning_output,
    evidence_selection,
    proposal_validity,
    confidence_calibration,
    tool_selection,
  };

  const allGood =
    reasoning_output &&
    evidence_selection &&
    proposal_validity &&
    confidence_calibration &&
    tool_selection;

  // For negatives, "passed" means the evaluator correctly detected poor agent quality
  const passed = isNegative ? !allGood : allGood;
  if (isNegative && allGood) notes.push("negative_agent_unexpectedly_good");

  const scoreParts = Object.values(dims).map((v) => (v ? 1 : 0));
  const score = Math.round((scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length) * 1000) / 1000;

  return { passed, score, notes, dimensions: dims };
}
