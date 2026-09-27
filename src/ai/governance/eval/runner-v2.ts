/**
 * Evaluation 2.0 runner — composes governance v1 + golden + quality scorers.
 * Read-only: never mutates Decision / Living Plan / production.
 */
import { AI_EVAL_VERSION, GOLDEN_DATASET_VERSION } from "@/ai/governance/version";
import { runAiEvaluation, type EvalSuiteResult } from "@/ai/governance/eval/runner";
import {
  defaultGoldenArtifacts,
  getActiveGoldenCases,
  type GoldenCase,
} from "@/ai/governance/eval/golden/dataset";
import type { EvalArtifact, GoldenDomain } from "@/ai/governance/eval/golden/types";
import { scoreEvidenceForGolden } from "@/ai/governance/eval/evidence-quality";
import { evaluateDecisionQuality } from "@/ai/governance/eval/decision-quality";
import { evaluateAgentQuality } from "@/ai/governance/eval/agent-quality";
import {
  applyThresholds,
  DEFAULT_EVAL_THRESHOLDS,
  type EvalThresholds,
  type ThresholdResult,
} from "@/ai/governance/eval/thresholds";

export type EvalSuiteName = "governance" | "golden" | "evidence" | "decision" | "agent";

export type DomainEvalSummary = {
  passed: number;
  failed: number;
  scores: {
    evidence_quality: number;
    decision_quality: number;
    agent_quality: number;
  };
};

export type GoldenCaseResult = {
  case_id: string;
  domain: GoldenDomain;
  passed: boolean;
  evidence_passed: boolean;
  decision_passed: boolean;
  agent_passed: boolean;
  notes: string[];
  scores: {
    evidence_quality: number;
    relevance: number;
    citation_correctness: number;
    decision: number;
    agent: number;
  };
};

export type EvaluationReport = {
  evaluation_version: string;
  dataset_version: string;
  agent_version: string | null;
  model: string | null;
  provider: string | null;
  timestamp: string;
  by_domain: Partial<Record<GoldenDomain, DomainEvalSummary>>;
  governance: EvalSuiteResult | null;
  golden_results: GoldenCaseResult[];
  threshold_result: ThresholdResult;
  review_pending_count: number;
  ok: boolean;
};

function emptyDomain(): DomainEvalSummary {
  return {
    passed: 0,
    failed: 0,
    scores: { evidence_quality: 0, decision_quality: 0, agent_quality: 0 },
  };
}

export function runAiEvaluationV2(opts?: {
  suites?: EvalSuiteName[];
  goldenCases?: GoldenCase[];
  artifacts?: Record<string, EvalArtifact>;
  thresholds?: EvalThresholds;
  agent_version?: string;
  model?: string;
  provider?: string;
}): EvaluationReport {
  const suites = new Set(
    opts?.suites ?? (["governance", "golden", "evidence", "decision", "agent"] as EvalSuiteName[]),
  );
  const thresholds = opts?.thresholds ?? DEFAULT_EVAL_THRESHOLDS;
  const goldenCases = opts?.goldenCases ?? getActiveGoldenCases();
  const artifacts = opts?.artifacts ?? defaultGoldenArtifacts();

  let governance: EvalSuiteResult | null = null;
  if (suites.has("governance")) {
    governance = runAiEvaluation();
  }

  const golden_results: GoldenCaseResult[] = [];
  const by_domain: Partial<Record<GoldenDomain, DomainEvalSummary>> = {};

  let citeSum = 0;
  let citeN = 0;
  let relSum = 0;
  let relN = 0;
  let proposalOk = 0;
  let proposalN = 0;
  let toolOk = 0;
  let toolN = 0;
  let safetyOk = 0;
  let safetyN = 0;

  if (
    suites.has("golden") ||
    suites.has("evidence") ||
    suites.has("decision") ||
    suites.has("agent")
  ) {
    for (const g of goldenCases) {
      const art = artifacts[g.case_id];
      const isNeg = (g.tags ?? []).includes("negative");
      if (!art) {
        golden_results.push({
          case_id: g.case_id,
          domain: g.domain,
          passed: false,
          evidence_passed: false,
          decision_passed: false,
          agent_passed: false,
          notes: ["artifact_missing"],
          scores: {
            evidence_quality: 0,
            relevance: 0,
            citation_correctness: 0,
            decision: 0,
            agent: 0,
          },
        });
        continue;
      }

      const ev = scoreEvidenceForGolden(g, art);
      const dec = evaluateDecisionQuality(g, art);
      const ag = evaluateAgentQuality(g, art);

      const runEvidence = suites.has("evidence") || suites.has("golden");
      const runDecision = suites.has("decision") || suites.has("golden");
      const runAgent = suites.has("agent") || suites.has("golden");

      // Negatives: suite pass = quality correctly rejected (evidence inverted here;
      // decision/agent scorers already invert).
      const evidence_passed = runEvidence ? (isNeg ? !ev.passed : ev.passed) : true;
      const decision_passed = runDecision ? dec.passed : true;
      const agent_passed = runAgent ? ag.passed : true;
      const passed = evidence_passed && decision_passed && agent_passed;

      const notes = [
        ...(runEvidence ? ev.notes : []),
        ...(runDecision ? dec.notes : []),
        ...(runAgent ? ag.notes : []),
      ];

      golden_results.push({
        case_id: g.case_id,
        domain: g.domain,
        passed,
        evidence_passed,
        decision_passed,
        agent_passed,
        notes,
        scores: {
          evidence_quality: ev.evidence_quality,
          relevance: ev.relevance,
          citation_correctness: ev.citation_correctness,
          decision: dec.score,
          agent: ag.score,
        },
      });

      const dom = by_domain[g.domain] ?? emptyDomain();
      if (passed) dom.passed += 1;
      else dom.failed += 1;
      const total = dom.passed + dom.failed;
      dom.scores.evidence_quality =
        (dom.scores.evidence_quality * (total - 1) + ev.evidence_quality) / total;
      dom.scores.decision_quality =
        (dom.scores.decision_quality * (total - 1) + dec.score) / total;
      dom.scores.agent_quality = (dom.scores.agent_quality * (total - 1) + ag.score) / total;
      by_domain[g.domain] = dom;

      // Thresholds only from positive cases (negatives are detection fixtures)
      if (!isNeg) {
        citeSum += ev.citation_correctness;
        citeN += 1;
        relSum += ev.relevance;
        relN += 1;

        proposalN += 1;
        if (ag.dimensions.proposal_validity) proposalOk += 1;
        toolN += 1;
        if (ag.dimensions.tool_selection) toolOk += 1;

        safetyN += 1;
        if ((art.safety_violations ?? 0) === 0 && dec.dimensions.safety_respected) safetyOk += 1;
      }
    }
  }

  // Fold governance critical rates into safety / tool auth
  if (governance) {
    const govSafety = governance.results.filter((r) =>
      ["eval_safety_rejection", "eval_wrong_user", "eval_unauthorized_tool"].includes(r.case_id),
    );
    for (const r of govSafety) {
      if (r.case_id === "eval_unauthorized_tool") {
        toolN += 1;
        if (r.passed) toolOk += 1;
      } else {
        safetyN += 1;
        if (r.passed) safetyOk += 1;
      }
    }
    const govProposal = governance.results.find((r) => r.case_id === "eval_invalid_proposal");
    if (govProposal) {
      proposalN += 1;
      if (govProposal.passed) proposalOk += 1;
    }
  }

  const threshold_result = applyThresholds(
    {
      critical_safety_pass_rate: safetyN === 0 ? 1 : safetyOk / safetyN,
      proposal_validity_pass_rate: proposalN === 0 ? 1 : proposalOk / proposalN,
      citation_correctness_avg: citeN === 0 ? 1 : citeSum / citeN,
      evidence_relevance_avg: relN === 0 ? 1 : relSum / relN,
      tool_authorization_pass_rate: toolN === 0 ? 1 : toolOk / toolN,
    },
    thresholds,
  );

  const review_pending_count = goldenCases.filter((c) => c.review_status === "pending").length;

  const sampleArt = Object.values(artifacts)[0];
  const govOk = governance ? governance.failed === 0 : true;
  const goldenOk = golden_results.every((r) => r.passed);
  const ok = threshold_result.ok && govOk && goldenOk;

  return {
    evaluation_version: AI_EVAL_VERSION,
    dataset_version: GOLDEN_DATASET_VERSION,
    agent_version: opts?.agent_version ?? sampleArt?.agent_version ?? null,
    model: opts?.model ?? sampleArt?.model ?? null,
    provider: opts?.provider ?? sampleArt?.provider ?? null,
    timestamp: new Date().toISOString(),
    by_domain,
    governance,
    golden_results,
    threshold_result,
    review_pending_count,
    ok,
  };
}
