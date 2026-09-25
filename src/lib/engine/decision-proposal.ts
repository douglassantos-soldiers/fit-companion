/**
 * DecisionProposal — AI/Coach suggestions validated against the authoritative Decision Engine.
 * Never promote a Proposal to Decision by copying proposed_value; Decision always comes from the engine.
 */
import type { CoachProposal, CoachProposalType } from "@/lib/coach/types";
import { decisionsFromBundle, type Decision } from "@/lib/engine/decision-contract";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { DecisionEvidence, DecisionEvidenceItem } from "@/lib/engine/decision-evidence";
import { canonicalReasonCode, type ReasonCode } from "@/lib/engine/reason-codes";
import type { SafetyVerdict } from "@/lib/engine/safety";

export type DecisionProposalSource = "coach" | "agent" | "system";

export type DecisionProposal = {
  proposal_id: string;
  user_id: string;
  context_id?: string;
  proposed_type: string;
  proposed_value: string | number | boolean;
  reason_codes: ReasonCode[];
  evidence?: DecisionEvidence;
  confidence: number;
  source: DecisionProposalSource;
  created_at: string;
};

export type ResolveProposalResult = {
  ok: boolean;
  decision: Decision | null;
  rejection_reason?: string;
  /** Always the engine-authored decisions for this snapshot — never from the proposal. */
  authoritative: Decision[];
};

const PROPOSAL_SOURCES = new Set<DecisionProposalSource>(["coach", "agent", "system"]);

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) + h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

export function buildProposalId(parts: {
  userId: string;
  proposedType: string;
  proposedValue: string | number | boolean;
  createdAt: string;
}): string {
  return `prop_${djb2(
    [parts.userId, parts.proposedType, String(parts.proposedValue), parts.createdAt].join("|"),
  )}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Fail-closed schema parse for inbound proposals (Coach / Agent). */
export function parseDecisionProposal(
  raw: unknown,
): { ok: true; proposal: DecisionProposal } | { ok: false; error: string } {
  if (!isPlainObject(raw)) return { ok: false, error: "proposal_not_object" };

  const proposal_id = typeof raw["proposal_id"] === "string" ? raw["proposal_id"].trim() : "";
  const user_id = typeof raw["user_id"] === "string" ? raw["user_id"].trim() : "";
  const proposed_type = typeof raw["proposed_type"] === "string" ? raw["proposed_type"].trim() : "";
  const proposed_value = raw["proposed_value"];
  const source = raw["source"];
  const created_at = typeof raw["created_at"] === "string" ? raw["created_at"] : "";
  const confidence = typeof raw["confidence"] === "number" ? raw["confidence"] : NaN;

  if (!proposal_id) return { ok: false, error: "missing_proposal_id" };
  if (!user_id) return { ok: false, error: "missing_user_id" };
  if (!proposed_type) return { ok: false, error: "missing_proposed_type" };
  if (
    typeof proposed_value !== "string" &&
    typeof proposed_value !== "number" &&
    typeof proposed_value !== "boolean"
  ) {
    return { ok: false, error: "invalid_proposed_value" };
  }
  if (!PROPOSAL_SOURCES.has(source as DecisionProposalSource)) {
    return { ok: false, error: "invalid_source" };
  }
  if (!created_at) return { ok: false, error: "missing_created_at" };
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { ok: false, error: "invalid_confidence" };
  }

  const reasonRaw = Array.isArray(raw["reason_codes"]) ? raw["reason_codes"] : [];
  const reason_codes = [
    ...new Set(
      reasonRaw
        .filter((c): c is string => typeof c === "string" && c.length > 0)
        .map((c) => canonicalReasonCode(c)),
    ),
  ].slice(0, 12) as ReasonCode[];

  let evidence: DecisionEvidence | undefined;
  const evidenceRaw = raw["evidence"];
  if (evidenceRaw != null) {
    if (!isPlainObject(evidenceRaw) || !isPlainObject(evidenceRaw["metrics"])) {
      return { ok: false, error: "invalid_evidence" };
    }
    const built: DecisionEvidence = {
      metrics: evidenceRaw["metrics"] as DecisionEvidence["metrics"],
    };
    if (Array.isArray(evidenceRaw["notes"])) {
      built.notes = (evidenceRaw["notes"] as unknown[]).filter(
        (n): n is string => typeof n === "string",
      );
    }
    if (Array.isArray(evidenceRaw["items"])) {
      const items = evidenceRaw["items"] as DecisionEvidenceItem[];
      built.items = items;
    }
    evidence = built;
  }

  const proposal: DecisionProposal = {
    proposal_id,
    user_id,
    proposed_type,
    proposed_value,
    reason_codes,
    confidence,
    source: source as DecisionProposalSource,
    created_at,
  };
  const contextId = raw["context_id"];
  if (typeof contextId === "string" && contextId.trim()) {
    proposal.context_id = contextId.trim();
  }
  if (evidence) proposal.evidence = evidence;
  return { ok: true, proposal };
}

export function validateProposalContext(
  proposal: DecisionProposal,
  snapshot: DecisionContextSnapshot,
): { ok: boolean; reason?: string } {
  if (proposal.user_id !== snapshot.userId) {
    return { ok: false, reason: "user_mismatch" };
  }
  if (proposal.context_id && proposal.context_id !== snapshot.inputFingerprint) {
    return { ok: false, reason: "context_fingerprint_mismatch" };
  }
  return { ok: true };
}

/**
 * Safety gate: escalateCare only aligns with REST / rest-like proposals.
 * Does not invent a Decision — only accepts/rejects the proposal.
 */
export function validateProposalAgainstSafety(
  proposal: DecisionProposal,
  safety: SafetyVerdict,
): { ok: boolean; reason?: string } {
  if (!safety.escalateCare) return { ok: true };
  const restAligned =
    proposal.proposed_type === "REST" ||
    proposal.proposed_type === "INCREASE_RECOVERY" ||
    proposal.proposed_type === "SLEEP_FOCUS" ||
    (typeof proposal.proposed_value === "string" &&
      (proposal.proposed_value === "rest" || proposal.proposed_value === "sleep"));
  if (!restAligned) {
    return { ok: false, reason: "escalate_requires_rest_aligned" };
  }
  return { ok: true };
}

function trainingModeDecision(authoritative: Decision[]): Decision | null {
  return (
    authoritative.find(
      (d) =>
        d.engine_decision_type === "training_mode" ||
        d.decision_type === "WORKOUT_MODE" ||
        d.decision_type === "REST" ||
        d.decision_type === "DELOAD",
    ) ??
    authoritative.find((d) => d.what.primary) ??
    authoritative[0] ??
    null
  );
}

function proposalAlignsWithMode(
  proposal: DecisionProposal,
  mode: string,
  volume: number,
): { ok: boolean; reason?: string } {
  const type = proposal.proposed_type;
  if (type === "FULL_WORKOUT" && (mode === "rest" || mode === "deload")) {
    return { ok: false, reason: `conflicts_with_training_mode=${mode}` };
  }
  if (type === "EXPRESS_WORKOUT" && mode === "rest") {
    return { ok: false, reason: "conflicts_with_training_mode=rest" };
  }
  if (type === "DELOAD" && mode === "rest") {
    return { ok: false, reason: "conflicts_with_training_mode=rest" };
  }
  if (type === "REDUCE_VOLUME" && volume >= 0.95 && mode === "full") {
    // Allowed but not a hard reject — engine still owns Decision
    return { ok: true };
  }
  if (
    typeof proposal.proposed_value === "string" &&
    ["full", "express", "deload", "rest"].includes(proposal.proposed_value) &&
    proposal.proposed_value !== mode &&
    (mode === "rest" || proposal.proposed_value === "full")
  ) {
    if (mode === "rest" && proposal.proposed_value !== "rest") {
      return { ok: false, reason: `conflicts_with_training_mode=${mode}` };
    }
  }
  return { ok: true };
}

/**
 * Resolve proposal against the live engine bundle.
 * Decision is ALWAYS from decisionsFromBundle — never copied from proposed_value.
 */
export function resolveProposalAgainstEngine(
  proposal: DecisionProposal,
  snapshot: DecisionContextSnapshot,
): ResolveProposalResult {
  const authoritative = decisionsFromBundle(snapshot);
  const primary = trainingModeDecision(authoritative);

  const ctxCheck = validateProposalContext(proposal, snapshot);
  if (!ctxCheck.ok) {
    const out: ResolveProposalResult = {
      ok: false,
      decision: primary,
      authoritative,
    };
    if (ctxCheck.reason) out.rejection_reason = ctxCheck.reason;
    return out;
  }

  const safetyCheck = validateProposalAgainstSafety(proposal, snapshot.safety);
  if (!safetyCheck.ok) {
    const out: ResolveProposalResult = {
      ok: false,
      decision: primary,
      authoritative,
    };
    if (safetyCheck.reason) out.rejection_reason = safetyCheck.reason;
    return out;
  }

  const align = proposalAlignsWithMode(
    proposal,
    snapshot.decisions.trainingMode,
    snapshot.decisions.trainingVolume,
  );
  if (!align.ok) {
    const out: ResolveProposalResult = {
      ok: false,
      decision: primary,
      authoritative,
    };
    if (align.reason) out.rejection_reason = align.reason;
    return out;
  }

  return {
    ok: true,
    decision: primary,
    authoritative,
  };
}

const COACH_TYPE_TO_PROPOSED: Record<
  CoachProposalType,
  { proposed_type: string; mapValue: (v: string | number | boolean) => string | number | boolean }
> = {
  REDUCE_VOLUME: { proposed_type: "REDUCE_VOLUME", mapValue: (v) => v },
  INCREASE_RECOVERY: { proposed_type: "INCREASE_RECOVERY", mapValue: (v) => v },
  REST: { proposed_type: "REST", mapValue: () => "rest" },
  EXPRESS_WORKOUT: { proposed_type: "EXPRESS_WORKOUT", mapValue: () => "express" },
  FULL_WORKOUT: { proposed_type: "FULL_WORKOUT", mapValue: () => "full" },
  DELOAD: { proposed_type: "DELOAD", mapValue: () => "deload" },
  NUTRITION_FOCUS: { proposed_type: "NUTRITION_FOCUS", mapValue: (v) => v },
  HYDRATION_FOCUS: { proposed_type: "HYDRATION_FOCUS", mapValue: (v) => v },
  SLEEP_FOCUS: { proposed_type: "SLEEP_FOCUS", mapValue: (v) => v },
  CHECKIN: { proposed_type: "CHECKIN", mapValue: (v) => v },
};

/** Bridge legacy CoachProposal → DecisionProposal (no second validator). */
export function toDecisionProposal(
  coach: CoachProposal,
  opts: {
    userId: string;
    contextId?: string;
    createdAt?: string;
    proposalId?: string;
  },
): DecisionProposal {
  const created_at = opts.createdAt ?? new Date().toISOString();
  const mapped = COACH_TYPE_TO_PROPOSED[coach.type];
  const proposed_value = mapped.mapValue(coach.value);
  const proposal_id =
    opts.proposalId ??
    buildProposalId({
      userId: opts.userId,
      proposedType: mapped.proposed_type,
      proposedValue: proposed_value,
      createdAt: created_at,
    });
  const proposal: DecisionProposal = {
    proposal_id,
    user_id: opts.userId,
    proposed_type: mapped.proposed_type,
    proposed_value,
    reason_codes: coach.reasonCodes.map((c) => canonicalReasonCode(c)),
    confidence: Math.max(0, Math.min(1, coach.confidence)),
    source: "coach",
    created_at,
    evidence: {
      metrics: { ...coach.evidence },
    },
  };
  if (opts.contextId) proposal.context_id = opts.contextId;
  return proposal;
}
