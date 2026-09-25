/**
 * Retrieval — semantic (cosine) + keyword fallback + filters + scoring.
 */

import type { KnowledgeCitation } from "@/ai/contracts/knowledge-citation";
import type {
  KnowledgeRetrieval,
  KnowledgeRetrievalHit,
  KnowledgeRetrievalMode,
} from "@/ai/contracts/knowledge-retrieval";
import { RAG_ERROR, RagError } from "@/ai/rag/core/errors";
import { listKnowledgeChunks } from "@/ai/rag/core/store";
import type { RetrieveKnowledgeOptions, RetrieveKnowledgeResult } from "@/ai/rag/core/types";
import { cosineSimilarity, getEmbeddingProvider, tokenize } from "@/ai/rag/embeddings";
import { rerankHits } from "@/ai/rag/reranking";

function newRetrievalId(): string {
  return `kr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function keywordScore(queryTokens: string[], content: string): number {
  if (queryTokens.length === 0) return 0;
  const contentTokens = new Set(tokenize(content));
  let hits = 0;
  for (const t of queryTokens) {
    if (contentTokens.has(t)) hits += 1;
  }
  return hits / queryTokens.length;
}

function excerpt(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function toCitation(hit: KnowledgeRetrievalHit): KnowledgeCitation {
  const c: KnowledgeCitation = {
    citation_id: `cite_${hit.chunk_id}`,
    document_id: hit.document_id,
    chunk_id: hit.chunk_id,
    title: hit.title,
    score: hit.score,
    excerpt: hit.excerpt,
  };
  if (hit.source_id) c.source_id = hit.source_id;
  if (hit.uri) c.uri = hit.uri;
  return c;
}

export function getCitationsFromRetrieval(retrieval: KnowledgeRetrieval): KnowledgeCitation[] {
  return retrieval.hits.map(toCitation);
}

export async function retrieveKnowledge(
  opts: RetrieveKnowledgeOptions,
): Promise<RetrieveKnowledgeResult> {
  const query = opts.query?.trim() ?? "";
  if (!query) {
    throw new RagError(RAG_ERROR.EMPTY_QUERY, "query_required");
  }

  const started = Date.now();
  const mode: KnowledgeRetrievalMode = opts.mode ?? "hybrid";
  const topK = opts.topK ?? 5;
  const provider = getEmbeddingProvider();
  const queryEmbedding = await provider.embed(query);
  const queryTokens = tokenize(query);

  const candidates = listKnowledgeChunks({
    ...(opts.domains ? { domains: opts.domains } : {}),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
    ...(opts.kbRefs ? { kbRefs: opts.kbRefs } : {}),
  });

  const scored: KnowledgeRetrievalHit[] = [];
  for (const { document, chunk } of candidates) {
    const emb = chunk.embedding ?? (await provider.embed(chunk.content));
    const semantic = cosineSimilarity(queryEmbedding, emb);
    const keyword = keywordScore(queryTokens, `${document.title} ${chunk.content}`);

    let include = false;
    if (mode === "semantic") include = semantic > 0.05;
    else if (mode === "keyword") include = keyword > 0;
    else include = semantic > 0.05 || keyword > 0;

    if (!include) continue;

    const hit: KnowledgeRetrievalHit = {
      chunk_id: chunk.chunk_id,
      document_id: document.document_id,
      domain: document.domain,
      score: 0,
      semantic_score: semantic,
      keyword_score: keyword,
      title: document.title,
      excerpt: excerpt(chunk.content),
      metadata: { ...document.metadata, ...(chunk.metadata ?? {}) },
    };
    const sourceId = document.metadata["source_id"];
    if (typeof sourceId === "string") hit.source_id = sourceId;
    if (document.uri) hit.uri = document.uri;
    scored.push(hit);
  }

  // Keyword fallback: if hybrid/semantic yielded nothing, retry keyword-only on same candidates
  if (scored.length === 0 && (mode === "hybrid" || mode === "semantic")) {
    for (const { document, chunk } of candidates) {
      const keyword = keywordScore(queryTokens, `${document.title} ${chunk.content}`);
      if (keyword <= 0) continue;
      const hit: KnowledgeRetrievalHit = {
        chunk_id: chunk.chunk_id,
        document_id: document.document_id,
        domain: document.domain,
        score: 0,
        semantic_score: 0,
        keyword_score: keyword,
        title: document.title,
        excerpt: excerpt(chunk.content),
        metadata: { ...document.metadata, ...(chunk.metadata ?? {}) },
      };
      const sourceId = document.metadata["source_id"];
      if (typeof sourceId === "string") hit.source_id = sourceId;
      if (document.uri) hit.uri = document.uri;
      scored.push(hit);
    }
  }

  const ranked = rerankHits(
    scored,
    opts.domains ? { preferredDomains: opts.domains } : undefined,
  ).slice(0, topK);

  const retrieval: KnowledgeRetrieval = {
    retrieval_id: newRetrievalId(),
    query,
    mode,
    hits: ranked,
    latency_ms: Date.now() - started,
    created_at: new Date().toISOString(),
  };
  if (opts.domains) retrieval.domain_filter = opts.domains;
  if (opts.metadata) retrieval.metadata_filter = opts.metadata;

  // Lazy import to avoid circular init with governance ↔ rag
  const { recordRagRetrieval } = await import("@/ai/governance/rag-retrieval-log");
  recordRagRetrieval(retrieval, {
    ...(opts.audit?.userId ? { userId: opts.audit.userId } : {}),
    ...(opts.audit?.runId ? { runId: opts.audit.runId } : {}),
    ...(opts.audit?.agentId ? { agentId: opts.audit.agentId } : {}),
  });

  return {
    retrieval,
    citations: getCitationsFromRetrieval(retrieval),
  };
}

/** Resolve skill kb:* refs to citations (bridge; does not run skills). */
export async function resolveKnowledgeRefs(
  kbRefs: string[],
  opts?: { topKPerRef?: number },
): Promise<RetrieveKnowledgeResult> {
  const topK = opts?.topKPerRef ?? 3;
  const started = Date.now();
  const allHits: KnowledgeRetrievalHit[] = [];
  const seen = new Set<string>();

  for (const ref of kbRefs) {
    const partial = await retrieveKnowledge({
      query: ref.replace(/^kb:/, "").replace(/\./g, " "),
      kbRefs: [ref],
      topK,
      mode: "hybrid",
    });
    for (const h of partial.retrieval.hits) {
      if (seen.has(h.chunk_id)) continue;
      seen.add(h.chunk_id);
      allHits.push(h);
    }
  }

  const ranked = rerankHits(allHits).slice(0, topK * Math.max(1, kbRefs.length));
  const retrieval: KnowledgeRetrieval = {
    retrieval_id: newRetrievalId(),
    query: kbRefs.join(","),
    mode: "hybrid",
    hits: ranked,
    latency_ms: Date.now() - started,
    created_at: new Date().toISOString(),
  };

  return {
    retrieval,
    citations: getCitationsFromRetrieval(retrieval),
  };
}
