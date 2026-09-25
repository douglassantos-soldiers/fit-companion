/**
 * Reranking — composite score (semantic + keyword + domain preference).
 */

import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import type { KnowledgeRetrievalHit } from "@/ai/contracts/knowledge-retrieval";

export function rerankHits(
  hits: KnowledgeRetrievalHit[],
  opts?: {
    preferredDomains?: KnowledgeDomain[];
    semanticWeight?: number;
    keywordWeight?: number;
  },
): KnowledgeRetrievalHit[] {
  const sw = opts?.semanticWeight ?? 0.65;
  const kw = opts?.keywordWeight ?? 0.35;
  const preferred = new Set(opts?.preferredDomains ?? []);

  return [...hits]
    .map((h) => {
      let score = h.semantic_score * sw + h.keyword_score * kw;
      if (preferred.has(h.domain)) score += 0.05;
      return { ...h, score: Math.max(0, Math.min(1, score)) };
    })
    .sort((a, b) => b.score - a.score);
}
