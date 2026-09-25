/**
 * Evaluation Framework — 12 failure modes (positive suite + negatives).
 */
import { describe, expect, it } from "vitest";
import {
  AI_EVAL_CASES,
  EVAL_CHECKERS,
  EVAL_NEGATIVE_FIXTURES,
  EVAL_SUITE_FIXTURES,
  getActiveEvalCases,
  runAiEvaluation,
} from "@/ai/governance";

describe("AI Evaluation Framework", () => {
  it("catalog has 12 active cases", () => {
    expect(AI_EVAL_CASES.length).toBe(12);
    expect(getActiveEvalCases().length).toBe(12);
  });

  it("positive suite passes all cases", () => {
    const suite = runAiEvaluation();
    expect(suite.total).toBe(12);
    expect(suite.passed).toBe(12);
    expect(suite.failed).toBe(0);
    expect(suite.results.every((r) => r.passed)).toBe(true);
  });

  it("negative fixtures fail each checker", () => {
    for (const c of getActiveEvalCases()) {
      const checker = EVAL_CHECKERS[c.name];
      expect(checker, c.name).toBeTypeOf("function");
      const neg = EVAL_NEGATIVE_FIXTURES[c.name] ?? {};
      const result = checker!(neg);
      expect(result.passed, c.name).toBe(false);
    }
  });

  it("hallucination fails without evidence", () => {
    const r = EVAL_CHECKERS["hallucination"]!({
      claim: "Clinical diagnosis invented",
      citations: [],
      evidenceSignals: [],
    });
    expect(r.passed).toBe(false);
  });

  it("wrong_user fails on mismatch", () => {
    const r = EVAL_CHECKERS["wrong_user"]!({
      trustedUserId: "a",
      auditUserId: "b",
    });
    expect(r.passed).toBe(false);
  });

  it("custom inputs override suite fixtures", () => {
    const suite = runAiEvaluation({
      inputs: {
        ...EVAL_SUITE_FIXTURES,
        hallucination: { claim: "x", citations: [], evidenceSignals: [] },
      },
    });
    const hall = suite.results.find((r) => r.case_id === "eval_hallucination");
    expect(hall?.passed).toBe(false);
    expect(suite.failed).toBeGreaterThanOrEqual(1);
  });
});
