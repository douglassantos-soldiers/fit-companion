/**
 * FASE 20 — Evaluation 2.0 + Golden Dataset
 */
import { describe, expect, it } from "vitest";
import {
  GOLDEN_DATASET,
  getActiveGoldenCases,
  GOLDEN_PASS_ARTIFACTS,
  GOLDEN_NEGATIVE_ARTIFACTS,
  defaultGoldenArtifacts,
  scoreEvidenceForGolden,
  evaluateDecisionQuality,
  evaluateAgentQuality,
  runAiEvaluation,
  runAiEvaluationV2,
  applyThresholds,
  DEFAULT_EVAL_THRESHOLDS,
  compareEvalArtifacts,
  AI_EVAL_VERSION,
  GOLDEN_DATASET_VERSION,
} from "@/ai/governance";

describe("FASE 20 golden dataset", () => {
  it("has active cases for core and FASE 23 domains", () => {
    const domains = new Set(getActiveGoldenCases().map((c) => c.domain));
    for (const d of [
      "training",
      "nutrition",
      "recovery",
      "sleep",
      "behavior",
      "performance",
      "exercise_selection",
      "exercise_substitution",
      "progression",
      "fatigue",
      "goal_adaptation",
    ]) {
      expect(domains.has(d as never)).toBe(true);
    }
    expect(GOLDEN_DATASET.length).toBeGreaterThanOrEqual(14);
    expect(GOLDEN_DATASET_VERSION).toBe("golden_v1");
  });
});

describe("FASE 20 evidence quality", () => {
  it("passes on well-supported golden training artifact", () => {
    const g = GOLDEN_DATASET.find((c) => c.case_id === "golden_training_deload")!;
    const art = GOLDEN_PASS_ARTIFACTS["golden_training_deload"]!;
    const ev = scoreEvidenceForGolden(g, art);
    expect(ev.passed).toBe(true);
    expect(ev.citation_correctness).toBeGreaterThanOrEqual(0.9);
  });

  it("fails when citation present but claim unsupported", () => {
    const g = GOLDEN_DATASET.find((c) => c.case_id === "golden_neg_citation_wrong_claim")!;
    const art = GOLDEN_NEGATIVE_ARTIFACTS["golden_neg_citation_wrong_claim"]!;
    const ev = scoreEvidenceForGolden(g, art);
    expect(ev.passed).toBe(false);
    expect(ev.notes.some((n) => n.includes("unsupported") || n.includes("does_not_support"))).toBe(
      true,
    );
  });
});

describe("FASE 20 decision quality", () => {
  it("does not mutate decision object", () => {
    const g = GOLDEN_DATASET.find((c) => c.case_id === "golden_training_deload")!;
    const art = structuredClone(GOLDEN_PASS_ARTIFACTS["golden_training_deload"]!);
    const before = JSON.stringify(art.decision);
    evaluateDecisionQuality(g, art);
    expect(JSON.stringify(art.decision)).toBe(before);
  });

  it("passes positive training decision", () => {
    const g = GOLDEN_DATASET.find((c) => c.case_id === "golden_training_deload")!;
    const r = evaluateDecisionQuality(g, GOLDEN_PASS_ARTIFACTS["golden_training_deload"]!);
    expect(r.passed).toBe(true);
  });
});

describe("FASE 20 agent quality", () => {
  it("flags overconfident weak evidence on negative", () => {
    const g = GOLDEN_DATASET.find((c) => c.case_id === "golden_neg_insufficient_evidence")!;
    const r = evaluateAgentQuality(g, GOLDEN_NEGATIVE_ARTIFACTS["golden_neg_insufficient_evidence"]!);
    expect(r.passed).toBe(true); // negative: correctly detected poor quality
    expect(r.notes.some((n) => n.includes("confidence") || n.includes("evidence"))).toBe(true);
  });
});

describe("FASE 20 runner v2 + thresholds", () => {
  it("keeps governance v1 12/12", () => {
    const suite = runAiEvaluation();
    expect(suite.passed).toBe(12);
    expect(suite.failed).toBe(0);
  });

  it("runAiEvaluationV2 ok with default fixtures", () => {
    const report = runAiEvaluationV2();
    expect(report.evaluation_version).toBe(AI_EVAL_VERSION);
    expect(report.dataset_version).toBe(GOLDEN_DATASET_VERSION);
    expect(report.governance?.passed).toBe(12);
    expect(report.golden_results.every((r) => r.passed)).toBe(true);
    expect(report.threshold_result.ok).toBe(true);
    expect(report.ok).toBe(true);
  });

  it("thresholds block on critical safety failure", () => {
    const r = applyThresholds(
      {
        critical_safety_pass_rate: 0.5,
        proposal_validity_pass_rate: 1,
        citation_correctness_avg: 1,
        evidence_relevance_avg: 1,
        tool_authorization_pass_rate: 1,
      },
      DEFAULT_EVAL_THRESHOLDS,
    );
    expect(r.ok).toBe(false);
    expect(r.blockers).toContain("critical_safety");
  });
});

describe("FASE 20 model comparison", () => {
  it("compares A vs B offline without ranking API", () => {
    const a = Object.values(GOLDEN_PASS_ARTIFACTS);
    const b = a.map((x) => ({
      ...x,
      model: "alt_model",
      latency_ms: (x.latency_ms ?? 0) + 20,
      estimated_cost: (x.estimated_cost ?? 0) + 0.01,
      pass: true,
    }));
    const cmp = compareEvalArtifacts(a, b, { a: "model_a", b: "model_b" });
    expect(cmp.a.case_count).toBe(a.length);
    expect(cmp.b.model).toBe("alt_model");
    expect(cmp.delta.latency_ms).toBeLessThan(0);
    expect(defaultGoldenArtifacts()["golden_training_deload"]).toBeTruthy();
  });
});
