/**
 * Deterministic AI Evaluation runner — no LLM.
 */
import { getActiveEvalCases, type EvalCase } from "@/ai/governance/eval/cases";
import {
  EVAL_CHECKERS,
  type EvalCheckInput,
  type EvalCheckResult,
} from "@/ai/governance/eval/checks";
import { AI_GOVERNANCE_VERSION } from "@/ai/governance/version";

export type EvalResult = {
  result_id: string;
  case_id: string;
  created_at: string;
  passed: boolean;
  score?: number;
  notes?: string[];
};

export type EvalSuiteResult = {
  suite_id: string;
  governance_version: string;
  created_at: string;
  passed: number;
  failed: number;
  total: number;
  results: EvalResult[];
};

/** Fixture inputs that make each active case pass when run as a suite. */
export const EVAL_SUITE_FIXTURES: Record<string, EvalCheckInput> = {
  hallucination: {
    claim: "Volume reduction helps recovery",
    citations: [{ citation_id: "c1", document_id: "d1" }],
    evidenceSignals: ["volume_reduction_helps"],
  },
  unsupported_claim: {
    reasonCodes: ["recovery_low"],
    evidenceSignals: ["recovery_low", "reason:recovery_low"],
  },
  wrong_user: {
    trustedUserId: "user_trusted_1",
    auditUserId: "user_trusted_1",
  },
  unauthorized_tool: {
    toolId: "get_training_context",
    allowedTools: ["get_training_context", "get_recovery_context"],
  },
  invalid_proposal: {
    proposalRejected: true,
  },
  safety_rejection: {
    safetyBlocked: true,
    runStatus: "blocked_by_safety",
  },
  wrong_evidence: {
    evidenceSignal: "training_volume",
    decisionType: "training_volume",
  },
  rag_failure: {
    ragRequired: true,
    ragHitCount: 2,
    ragError: false,
  },
  tool_failure: {
    toolFailed: true,
    toolCallRecorded: true,
  },
  model_timeout: {
    errorCode: "timeout",
    runStatus: "failed",
  },
  cost_limit: {
    estimatedCost: 120,
    costBudget: 50,
  },
  missing_context: {
    contextRequired: true,
    contextFingerprint: "fp_abc",
  },
};

/** Negative fixtures — expected to fail the checker (for unit tests). */
export const EVAL_NEGATIVE_FIXTURES: Record<string, EvalCheckInput> = {
  hallucination: { claim: "Invented medical diagnosis", citations: [], evidenceSignals: [] },
  unsupported_claim: {
    reasonCodes: ["made_up_code"],
    evidenceSignals: ["recovery_low"],
  },
  wrong_user: { trustedUserId: "user_a", auditUserId: "user_b" },
  unauthorized_tool: {
    toolId: "admin_wipe",
    allowedTools: ["get_training_context"],
  },
  invalid_proposal: { proposalRejected: false },
  safety_rejection: { safetyBlocked: false, runStatus: "completed" },
  wrong_evidence: {
    evidenceSignal: "nutrition_meal_only",
    decisionType: "training_volume",
  },
  rag_failure: { ragRequired: true, ragHitCount: 0, ragError: false },
  tool_failure: { toolFailed: true, toolCallRecorded: false },
  model_timeout: { errorCode: "other", runStatus: "completed" },
  cost_limit: { estimatedCost: 10, costBudget: 50 },
  missing_context: { contextRequired: true, contextFingerprint: null },
};

function runCase(c: EvalCase, input: EvalCheckInput): EvalResult {
  const checker = EVAL_CHECKERS[c.name];
  const check: EvalCheckResult = checker
    ? checker(input)
    : { passed: false, score: 0, notes: ["checker_missing"] };
  return {
    result_id: `er_${c.case_id}_${Date.now().toString(36)}`,
    case_id: c.case_id,
    created_at: new Date().toISOString(),
    passed: check.passed,
    score: check.score,
    notes: check.notes,
  };
}

export function runAiEvaluation(opts?: {
  cases?: EvalCase[];
  inputs?: Record<string, EvalCheckInput>;
}): EvalSuiteResult {
  const cases = opts?.cases ?? getActiveEvalCases();
  const inputs = opts?.inputs ?? EVAL_SUITE_FIXTURES;
  const results: EvalResult[] = [];
  for (const c of cases) {
    const input = inputs[c.name] ?? {};
    results.push(runCase(c, input));
  }
  const passed = results.filter((r) => r.passed).length;
  return {
    suite_id: `suite_${Date.now().toString(36)}`,
    governance_version: AI_GOVERNANCE_VERSION,
    created_at: new Date().toISOString(),
    passed,
    failed: results.length - passed,
    total: results.length,
    results,
  };
}

export type { EvalCheckInput, EvalCheckResult };
