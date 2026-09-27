/**
 * Evidence evaluation scorers — citation alone is never sufficient.
 * Deterministic; no LLM; does not mutate production.
 */
import type { EvalArtifact, GoldenCase, GoldenExpectedEvidence } from "@/ai/governance/eval/golden/types";

export type EvidenceEvalScores = {
  relevance: number;
  sufficiency: number;
  source_quality: number;
  freshness: number;
  citation_correctness: number;
  evidence_quality: number;
  passed: boolean;
  notes: string[];
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function packById(artifact: EvalArtifact): Map<string, NonNullable<EvalArtifact["evidence_pack"]>[number]> {
  const m = new Map<string, NonNullable<EvalArtifact["evidence_pack"]>[number]>();
  for (const e of artifact.evidence_pack ?? []) m.set(e.id, e);
  return m;
}

const TRUST: Record<string, number> = {
  curated: 1,
  internal: 0.85,
  fixture: 0.7,
  external_unverified: 0.35,
};

function claimSupportedBySignals(claim: string | undefined, signals: string[]): boolean {
  if (!claim || !claim.trim()) return signals.length > 0;
  const norm = claim.toLowerCase();
  // Token overlap heuristic: at least one evidence signal token appears in claim or vice-versa
  const claimTokens = new Set(norm.split(/[^a-z0-9_]+/).filter((t) => t.length > 3));
  for (const s of signals) {
    const st = s.toLowerCase();
    if (norm.includes(st.replace(/_/g, " ")) || norm.includes(st)) return true;
    for (const part of st.split("_")) {
      if (part.length > 3 && claimTokens.has(part)) return true;
    }
  }
  return false;
}

export function scoreEvidence(
  artifact: EvalArtifact,
  expected: GoldenExpectedEvidence,
  opts?: { asOf?: string; minQuality?: number },
): EvidenceEvalScores {
  const notes: string[] = [];
  const minQ = opts?.minQuality ?? expected.min_relevance ?? 0.45;
  const pack = artifact.evidence_pack ?? [];
  const byId = packById(artifact);
  const requiredSignals = expected.signals ?? [];
  const requiredCitations = expected.citation_ids ?? [];
  const actualClaim = artifact.claim?.trim() || undefined;
  const expectedClaims = expected.supported_claims ?? [];

  // Relevance: avg hit scores + signal overlap vs expected
  const scores = pack.map((p) => (typeof p.score === "number" ? p.score : 0));
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const observedSignals = new Set([
    ...(artifact.evidence_signals ?? []),
    ...pack.flatMap((p) => p.signals ?? []),
  ]);
  const signalHits =
    requiredSignals.length === 0
      ? 1
      : requiredSignals.filter((s) => observedSignals.has(s)).length / requiredSignals.length;
  const relevance = clamp01(avgScore * 0.5 + signalHits * 0.5);

  // Sufficiency: required signals covered + pack non-empty when citations expected
  const sufficiency = clamp01(
    signalHits * 0.7 +
      (requiredCitations.length === 0 || pack.length > 0 ? 0.3 : 0) +
      (pack.length >= Math.max(1, Math.ceil(requiredSignals.length / 2)) ? 0 : -0.2),
  );

  // Source quality
  const source_quality =
    pack.length === 0
      ? 0
      : clamp01(
          pack.reduce((s, p) => s + (TRUST[String(p.trust_level ?? "internal")] ?? 0.5), 0) /
            pack.length,
        );

  // Freshness
  const asOf = opts?.asOf ? Date.parse(opts.asOf) : Date.now();
  const freshness =
    pack.length === 0
      ? 0
      : clamp01(
          pack.reduce((s, p) => {
            if (!p.updated_at) return s + 0.5;
            const ageDays = (asOf - Date.parse(p.updated_at)) / (86400 * 1000);
            if (Number.isNaN(ageDays)) return s + 0.5;
            if (ageDays < 0) return s + 0.3;
            if (ageDays > 730) return s + 0.2;
            return s + 1;
          }, 0) / pack.length,
        );

  // Citation correctness: each citation must support the **actual claim** on the artifact
  // (expected.supported_claims alone is insufficient — citation ≠ correctness).
  let citeOk = 0;
  let citeTotal = 0;
  const seenCite = new Set<string>();
  for (const c of artifact.citations ?? []) {
    citeTotal += 1;
    const id = c.citation_id;
    if (!id || !byId.has(id)) {
      notes.push(`orphan_or_missing_citation:${id ?? "none"}`);
      continue;
    }
    seenCite.add(id);
    const entry = byId.get(id)!;
    const sigs = [...(entry.signals ?? []), ...(c.signals ?? [])];
    if (actualClaim && !claimSupportedBySignals(actualClaim, sigs)) {
      notes.push(`citation_does_not_support_claim:${id}`);
      continue;
    }
    citeOk += 1;
  }
  for (const req of requiredCitations) {
    if (seenCite.has(req)) continue;
    citeTotal += 1;
    if (!byId.has(req) && !(artifact.citations ?? []).some((c) => c.citation_id === req)) {
      notes.push(`missing_required_citation:${req}`);
    } else {
      const entry = byId.get(req);
      const sigs = entry?.signals ?? [];
      if (actualClaim && !claimSupportedBySignals(actualClaim, sigs)) {
        notes.push(`required_citation_unsupported:${req}`);
      } else {
        citeOk += 1;
      }
    }
  }
  const citation_correctness =
    citeTotal === 0 ? (pack.length > 0 ? 0.5 : 0) : clamp01(citeOk / citeTotal);

  // Explicit fail: has citations but artifact claim unsupported by those sources
  if ((artifact.citations?.length ?? 0) > 0 && actualClaim) {
    const anySupport = (artifact.citations ?? []).some((c) => {
      const entry = c.citation_id ? byId.get(c.citation_id) : undefined;
      const sigs = [...(entry?.signals ?? []), ...(c.signals ?? [])];
      return claimSupportedBySignals(actualClaim, sigs);
    });
    if (!anySupport) {
      notes.push("citation_present_but_claim_unsupported");
    }
  }

  // Optional: expected claims should also be supportable on positive fixtures
  for (const ec of expectedClaims) {
    const ok = pack.some((p) => claimSupportedBySignals(ec, p.signals ?? []));
    if (!ok && pack.length > 0 && actualClaim && claimSupportedBySignals(actualClaim, [...observedSignals])) {
      // actual claim ok but expected claim not in pack — soft note only when actual diverges
      if (actualClaim.toLowerCase() !== ec.toLowerCase()) {
        notes.push("actual_claim_diverges_from_expected");
      }
    }
  }

  const evidence_quality = clamp01(
    relevance * 0.3 +
      sufficiency * 0.2 +
      source_quality * 0.15 +
      freshness * 0.1 +
      citation_correctness * 0.25,
  );

  const minRel = expected.min_relevance ?? minQ;
  const passed =
    evidence_quality >= minQ &&
    relevance >= Math.min(minRel, 0.7) &&
    citation_correctness >= 0.9 &&
    !notes.includes("citation_present_but_claim_unsupported") &&
    !notes.some((n) => n.startsWith("citation_does_not_support_claim"));

  if (!passed && notes.length === 0) notes.push("evidence_below_threshold");

  return {
    relevance,
    sufficiency: clamp01(sufficiency),
    source_quality,
    freshness,
    citation_correctness,
    evidence_quality,
    passed,
    notes,
  };
}

export function scoreEvidenceForGolden(
  golden: GoldenCase,
  artifact: EvalArtifact,
): EvidenceEvalScores {
  return scoreEvidence(artifact, golden.expected_evidence);
}
