/**
 * Evidence quality — citation alone is not sufficient proof.
 */

import type { KnowledgeRetrievalHit } from "@/ai/contracts/knowledge-retrieval";
import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import { resolveTrustLevel, type KnowledgeTrustLevel } from "@/ai/contracts/knowledge-source";

export type EvidenceQualityScores = {
  relevance: number;
  sufficiency: number;
  source_quality: number;
  freshness: number;
  domain_match: number;
  evidence_quality: number;
  evidence_adequate: boolean;
};

const TRUST_SCORE: Record<KnowledgeTrustLevel, number> = {
  curated: 1,
  internal: 0.85,
  fixture: 0.7,
  external_unverified: 0.35,
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function evaluateEvidenceQuality(
  hits: KnowledgeRetrievalHit[],
  opts?: {
    preferredDomains?: KnowledgeDomain[];
    asOf?: string;
    minQuality?: number;
  },
): EvidenceQualityScores {
  const minQ = opts?.minQuality ?? 0.45;
  if (hits.length === 0) {
    return {
      relevance: 0,
      sufficiency: 0,
      source_quality: 0,
      freshness: 0,
      domain_match: 0,
      evidence_quality: 0,
      evidence_adequate: false,
    };
  }

  const preferred = new Set(opts?.preferredDomains ?? []);
  const asOf = opts?.asOf ? Date.parse(opts.asOf) : Date.now();

  const relevance =
    hits.reduce((s, h) => s + (h.rerank_score ?? h.score), 0) / hits.length;

  const sufficiency = clamp01(hits.length / 2);

  const source_quality =
    hits.reduce((s, h) => {
      const tier = String(h.metadata?.["trust_level"] ?? "internal") as KnowledgeTrustLevel;
      return s + (TRUST_SCORE[tier] ?? 0.5);
    }, 0) / hits.length;

  const freshness =
    hits.reduce((s, h) => {
      const exp = h.metadata?.["expiration_date"];
      if (typeof exp === "string" && Date.parse(exp) < asOf) return s + 0;
      const eff = h.metadata?.["effective_date"];
      if (typeof eff === "string" && Date.parse(eff) > asOf) return s + 0.3;
      return s + 1;
    }, 0) / hits.length;

  const domain_match =
    preferred.size === 0
      ? 1
      : hits.reduce((s, h) => s + (preferred.has(h.domain) ? 1 : 0), 0) / hits.length;

  const evidence_quality = clamp01(
    relevance * 0.35 +
      sufficiency * 0.2 +
      source_quality * 0.2 +
      freshness * 0.15 +
      domain_match * 0.1,
  );

  return {
    relevance: clamp01(relevance),
    sufficiency,
    source_quality: clamp01(source_quality),
    freshness: clamp01(freshness),
    domain_match: clamp01(domain_match),
    evidence_quality,
    evidence_adequate: evidence_quality >= minQ && hits.length > 0 && relevance >= 0.08,
  };
}

/** Re-export helper for tests. */
export { resolveTrustLevel };
