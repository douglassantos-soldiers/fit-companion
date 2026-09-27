/**
 * Offline model A vs B comparison — no public ranking, no LLM judge.
 */
import type { EvalArtifact } from "@/ai/governance/eval/golden/types";

export type ModelComparisonSide = {
  label: string;
  model?: string;
  provider?: string;
  accuracy: number;
  evidence_quality_avg: number;
  latency_ms_avg: number;
  cost_avg: number;
  safety_violations: number;
  proposal_validity_rate: number;
  case_count: number;
};

export type ModelComparisonReport = {
  created_at: string;
  a: ModelComparisonSide;
  b: ModelComparisonSide;
  /** Internal delta only — not a public leaderboard. */
  delta: {
    accuracy: number;
    evidence_quality: number;
    latency_ms: number;
    cost: number;
    safety_violations: number;
    proposal_validity: number;
  };
};

function summarize(label: string, artifacts: EvalArtifact[]): ModelComparisonSide {
  const n = artifacts.length || 1;
  const accuracy = artifacts.filter((a) => a.pass === true).length / n;
  const evidence_quality_avg =
    artifacts.reduce((s, a) => {
      const scores = (a.evidence_pack ?? []).map((e) => e.score ?? 0);
      const avg = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : 0;
      return s + avg;
    }, 0) / n;
  const latency_ms_avg = artifacts.reduce((s, a) => s + (a.latency_ms ?? 0), 0) / n;
  const cost_avg = artifacts.reduce((s, a) => s + (a.estimated_cost ?? 0), 0) / n;
  const safety_violations = artifacts.reduce((s, a) => s + (a.safety_violations ?? 0), 0);
  const proposal_validity_rate =
    artifacts.filter((a) => a.proposal_valid !== false).length / n;
  const first = artifacts[0];
  return {
    label,
    model: first?.model,
    provider: first?.provider,
    accuracy: Math.round(accuracy * 1000) / 1000,
    evidence_quality_avg: Math.round(evidence_quality_avg * 1000) / 1000,
    latency_ms_avg: Math.round(latency_ms_avg * 1000) / 1000,
    cost_avg: Math.round(cost_avg * 10000) / 10000,
    safety_violations,
    proposal_validity_rate: Math.round(proposal_validity_rate * 1000) / 1000,
    case_count: artifacts.length,
  };
}

export function compareEvalArtifacts(
  a: EvalArtifact[],
  b: EvalArtifact[],
  labels?: { a?: string; b?: string },
): ModelComparisonReport {
  const sideA = summarize(labels?.a ?? "model_a", a);
  const sideB = summarize(labels?.b ?? "model_b", b);
  return {
    created_at: new Date().toISOString(),
    a: sideA,
    b: sideB,
    delta: {
      accuracy: Math.round((sideA.accuracy - sideB.accuracy) * 1000) / 1000,
      evidence_quality:
        Math.round((sideA.evidence_quality_avg - sideB.evidence_quality_avg) * 1000) / 1000,
      latency_ms: Math.round((sideA.latency_ms_avg - sideB.latency_ms_avg) * 1000) / 1000,
      cost: Math.round((sideA.cost_avg - sideB.cost_avg) * 10000) / 10000,
      safety_violations: sideA.safety_violations - sideB.safety_violations,
      proposal_validity:
        Math.round((sideA.proposal_validity_rate - sideB.proposal_validity_rate) * 1000) / 1000,
    },
  };
}

/** Convenience: compare two single-artifact maps by shared case_ids. */
export function compareArtifactMaps(
  mapA: Record<string, EvalArtifact>,
  mapB: Record<string, EvalArtifact>,
  labels?: { a?: string; b?: string },
): ModelComparisonReport {
  const ids = Object.keys(mapA).filter((id) => mapB[id] != null);
  return compareEvalArtifacts(
    ids.map((id) => mapA[id]!),
    ids.map((id) => mapB[id]!),
    labels,
  );
}
