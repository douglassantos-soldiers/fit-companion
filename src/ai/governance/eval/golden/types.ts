/**
 * Golden dataset types — FASE 20. Read-only fixtures for evaluation.
 * Evaluator never mutates Decision / Living Plan / production.
 */

export type GoldenDomain =
  | "training"
  | "nutrition"
  | "recovery"
  | "sleep"
  | "behavior"
  | "performance"
  | "exercise_selection"
  | "exercise_substitution"
  | "progression"
  | "fatigue"
  | "goal_adaptation";

export type GoldenReviewStatus = "pending" | "approved" | "rejected";

export type GoldenExpectedEvidence = {
  signals?: string[];
  citation_ids?: string[];
  min_relevance?: number;
  /** Claims that citations must support (citation alone is insufficient). */
  supported_claims?: string[];
};

export type GoldenDecisionCharacteristics = {
  must_have_why_what_expected?: boolean;
  allowed_decision_types?: string[];
  forbidden_reason_codes?: string[];
  must_respect_safety?: boolean;
};

export type GoldenCase = {
  case_id: string;
  domain: GoldenDomain;
  status: "draft" | "active" | "deprecated";
  input_context: Record<string, unknown>;
  expected_behavior: string[];
  expected_evidence: GoldenExpectedEvidence;
  expected_constraints: string[];
  expected_proposal: Record<string, unknown>;
  expected_decision_characteristics: GoldenDecisionCharacteristics;
  safety_constraints: string[];
  review_status?: GoldenReviewStatus;
  tags?: string[];
};

/** Observed artifact for a golden case (fixture or recorded run — never written to production). */
export type EvalArtifact = {
  case_id: string;
  model?: string;
  provider?: string;
  agent_version?: string;
  latency_ms?: number;
  estimated_cost?: number;
  trusted_user_id?: string;
  context_fingerprint?: string | null;
  claim?: string;
  citations?: Array<{ citation_id?: string; document_id?: string; signals?: string[] }>;
  evidence_pack?: Array<{
    id: string;
    signals?: string[];
    document_id?: string;
    score?: number;
    trust_level?: string;
    updated_at?: string;
    domain?: string;
  }>;
  evidence_signals?: string[];
  tools_used?: string[];
  allowed_tools?: string[];
  proposal?: Record<string, unknown>;
  proposal_valid?: boolean;
  proposal_rejected?: boolean;
  confidence?: number;
  reasoning_fields?: string[];
  decision?: {
    decision_type?: string;
    reason_codes?: string[];
    why?: unknown;
    what?: unknown;
    expected_outcome?: unknown;
    safety_status?: string;
    user_id?: string;
    context_fingerprint?: string | null;
    constraints_respected?: string[];
  };
  safety_blocked?: boolean;
  safety_violations?: number;
  behaviors_observed?: string[];
  pass?: boolean;
};
