/**
 * Reranking — composite score (semantic + keyword + domain + trust + freshness).
 */

import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import type { KnowledgeRetrievalHit } from "@/ai/contracts/knowledge-retrieval";

export function rerankHits(
  hits: KnowledgeRetrievalHit[],
  opts?: {
    preferredDomains?: KnowledgeDomain[];
    semanticWeight?: number;
    keywordWeight?: number;
    asOf?: string;
  },
): KnowledgeRetrievalHit[] {
  const sw = opts?.semanticWeight ?? 0.55;
  const kw = opts?.keywordWeight ?? 0.3;
  const preferred = new Set(opts?.preferredDomains ?? []);
  const asOf = opts?.asOf ? Date.parse(opts.asOf) : Date.now();

  return [...hits]
    .map((h) => {
      let score = h.semantic_score * sw + h.keyword_score * kw;
      if (preferred.has(h.domain)) score += 0.05;
      const trust = String(h.metadata?.["trust_level"] ?? "");
      if (trust === "curated") score += 0.04;
      else if (trust === "external_unverified") score -= 0.08;
      const exp = h.metadata?.["expiration_date"];
      if (typeof exp === "string" && Date.parse(exp) < asOf) score -= 0.2;
      const rerank_score = Math.max(0, Math.min(1, score));
      return { ...h, score: rerank_score, rerank_score };
    })
    .sort((a, b) => (b.rerank_score ?? b.score) - (a.rerank_score ?? a.score));
}
