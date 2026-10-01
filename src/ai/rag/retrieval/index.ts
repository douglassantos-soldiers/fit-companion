/**
 * Retrieval — hybrid semantic + keyword + metadata + rerank + evidence quality.
 * RAG never invents evidence on failure. FASE 22.2 — explicit availability.
 */

import type { KnowledgeCitation } from "@/ai/contracts/knowledge-citation";
import type {
  KnowledgeRetrieval,
  KnowledgeRetrievalHit,
  KnowledgeRetrievalMode,
  RagAvailability,
  RagRuntimeStatus,
} from "@/ai/contracts/knowledge-retrieval";
import { RAG_ERROR, RagError } from "@/ai/rag/core/errors";
import type { RetrieveKnowledgeOptions, RetrieveKnowledgeResult } from "@/ai/rag/core/types";
import { ensureVectorStore } from "@/ai/rag/core/vector-store";
import { cosineSimilarity, getEmbeddingProvider, tokenize } from "@/ai/rag/embeddings";
import { evaluateEvidenceQuality } from "@/ai/rag/evidence/quality";
import { rerankHits } from "@/ai/rag/reranking";

function newRetrievalId(): string {
  return `kr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function keywordScore(queryTokens: string[], content: string): number {
  if (queryTokens.length === 0) return 0;
  const contentTokens = new Set(tokenize(content));
  let hits = 0;
  for (const t of queryTokens) {
    if (contentTokens.has(t)) {
      hits += 1;
      continue;
    }
    if (t.length < 6) continue;
    for (const c of contentTokens) {
      if (c.length < 6) continue;
      const [short, long] = t.length <= c.length ? [t, c] : [c, t];
      if (long.startsWith(short) && long.length - short.length <= 4) {
        hits += 1;
        break;
      }
    }
  }
  return hits / queryTokens.length;
}

/** Semantic hits below this cosine are dropped. Keyword overlap still qualifies in hybrid mode. */
export const SEMANTIC_INCLUDE_MIN = 0.42;

function excerpt(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function buildCitation(
  hit: KnowledgeRetrievalHit,
  retrievalId: string,
): KnowledgeCitation {
  const section =
    typeof hit.metadata?.["section"] === "string" ? hit.metadata["section"] : undefined;
  const version =
    typeof hit.metadata?.["document_version"] === "string"
      ? hit.metadata["document_version"]
      : undefined;
  const effective =
    typeof hit.metadata?.["effective_date"] === "string"
      ? hit.metadata["effective_date"]
      : undefined;
  const c: KnowledgeCitation = {
    citation_id: `cite_${hit.chunk_id}`,
    document_id: hit.document_id,
    chunk_id: hit.chunk_id,
    title: hit.title,
    score: hit.rerank_score ?? hit.score,
    excerpt: hit.excerpt,
    retrieval_id: retrievalId,
    source: hit.source_id,
    document: hit.document_id,
    chunk: hit.chunk_id,
  };
  if (hit.source_id) c.source_id = hit.source_id;
  if (hit.uri) c.uri = hit.uri;
  if (section) c.section = section;
  if (version) c.document_version = version;
  if (effective) c.effective_date = effective;
  const kbRef = hit.metadata?.["kb_ref"];
  if (typeof kbRef === "string" && kbRef.length > 0) c.kb_ref = kbRef;
  return c;
}

export function getCitationsFromRetrieval(retrieval: KnowledgeRetrieval): KnowledgeCitation[] {
  if (retrieval.citations?.length) return retrieval.citations;
  return retrieval.hits.map((h) => h.citation ?? buildCitation(h, retrieval.retrieval_id));
}

export function deriveRagAvailability(
  status: RagRuntimeStatus,
  evidenceAdequate: boolean,
  hitCount: number,
): { availability: RagAvailability; error_code?: string } {
  if (status === "error" || status === "timeout" || status === "skipped") {
    return { availability: "RAG_UNAVAILABLE", error_code: RAG_ERROR.UNAVAILABLE };
  }
  if (status === "empty" || hitCount === 0) {
    return { availability: "RAG_DEGRADED", error_code: RAG_ERROR.EMPTY };
  }
  if (!evidenceAdequate) {
    return { availability: "RAG_DEGRADED", error_code: RAG_ERROR.LOW_CONFIDENCE };
  }
  return { availability: "RAG_AVAILABLE" };
}

function enrichRetrieval(retrieval: KnowledgeRetrieval): KnowledgeRetrieval {
  const citations = getCitationsFromRetrieval(retrieval);
  const sources = [
    ...new Set(
      retrieval.hits
        .map((h) => h.source_id)
        .filter((s): s is string => typeof s === "string" && s.length > 0),
    ),
  ];
  for (const h of retrieval.hits) {
    if (h.similarity == null) h.similarity = h.semantic_score;
  }
  const derived = deriveRagAvailability(
    retrieval.rag_status ?? "empty",
    Boolean(retrieval.evidence_available),
    retrieval.hits.length,
  );
  return {
    ...retrieval,
    citations,
    sources,
    rag_availability: derived.availability,
    ...(derived.error_code && derived.availability !== "RAG_AVAILABLE"
      ? { error_code: derived.error_code }
      : {}),
  };
}

export type RetrieveKnowledgeOptionsExt = RetrieveKnowledgeOptions & {
  asOf?: string;
  timeoutMs?: number;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new RagError(RAG_ERROR.TIMEOUT, "retrieval_timeout")),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function retrieveKnowledgeInner(
  opts: RetrieveKnowledgeOptionsExt,
): Promise<RetrieveKnowledgeResult> {
  const query = opts.query?.trim() ?? "";
  if (!query) {
    throw new RagError(RAG_ERROR.EMPTY_QUERY, "query_required");
  }

  const started = Date.now();
  const retrieval_id = newRetrievalId();
  const mode: KnowledgeRetrievalMode = opts.mode ?? "hybrid";
  const topK = opts.topK ?? 5;
  const asOf = opts.asOf ?? new Date().toISOString();
  const provider = getEmbeddingProvider();
  const queryEmbedding = await provider.embed(query);
  const queryTokens = tokenize(query);
  const store = await ensureVectorStore();

  const candidates = await store.listByFilter({
    ...(opts.domains ? { domains: opts.domains } : {}),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
    ...(opts.kbRefs ? { kbRefs: opts.kbRefs } : {}),
    asOf,
  });

  const scored: KnowledgeRetrievalHit[] = [];
  for (const { document, chunk } of candidates) {
    const emb = chunk.embedding ?? (await provider.embed(chunk.content));
    const semantic = cosineSimilarity(queryEmbedding, emb);
    const keyword = keywordScore(queryTokens, `${document.title} ${chunk.content}`);

    let include = false;
    if (mode === "semantic") include = semantic > SEMANTIC_INCLUDE_MIN;
    else if (mode === "keyword") include = keyword > 0;
    else include = semantic > SEMANTIC_INCLUDE_MIN || keyword > 0;

    if (!include) continue;

    const hit: KnowledgeRetrievalHit = {
      chunk_id: chunk.chunk_id,
      document_id: document.document_id,
      domain: document.domain,
      score: 0,
      semantic_score: semantic,
      keyword_score: keyword,
      similarity: semantic,
      title: document.title,
      excerpt: excerpt(chunk.content),
      content: chunk.content,
      metadata: { ...document.metadata, ...(chunk.metadata ?? {}) },
    };
    const sourceId =
      document.source_id ??
      (typeof document.metadata["source_id"] === "string"
        ? document.metadata["source_id"]
        : undefined);
    if (sourceId) hit.source_id = sourceId;
    if (document.uri) hit.uri = document.uri;
    scored.push(hit);
  }

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
        similarity: 0,
        title: document.title,
        excerpt: excerpt(chunk.content),
        content: chunk.content,
        metadata: { ...document.metadata, ...(chunk.metadata ?? {}) },
      };
      const sourceId =
        document.source_id ??
        (typeof document.metadata["source_id"] === "string"
          ? document.metadata["source_id"]
          : undefined);
      if (sourceId) hit.source_id = sourceId;
      if (document.uri) hit.uri = document.uri;
      scored.push(hit);
    }
  }

  const ranked = rerankHits(scored, {
    ...(opts.domains ? { preferredDomains: opts.domains } : {}),
    asOf,
  }).slice(0, topK);

  for (const h of ranked) {
    h.citation = buildCitation(h, retrieval_id);
  }

  const quality = evaluateEvidenceQuality(ranked, {
    ...(opts.domains ? { preferredDomains: opts.domains } : {}),
    asOf,
  });

  let rag_status: RagRuntimeStatus = "ok";
  if (ranked.length === 0) rag_status = "empty";

  let retrieval: KnowledgeRetrieval = {
    retrieval_id,
    query,
    mode,
    hits: ranked,
    latency_ms: Date.now() - started,
    created_at: new Date().toISOString(),
    rag_status,
    retrieval_status: rag_status,
    evidence_available: ranked.length > 0 && quality.evidence_adequate,
    as_of: asOf,
  };
  if (opts.domains) retrieval.domain_filter = opts.domains;
  if (opts.metadata) retrieval.metadata_filter = opts.metadata;
  retrieval = enrichRetrieval(retrieval);

  const { recordRagRetrieval } = await import("@/ai/governance/rag-retrieval-log");
  recordRagRetrieval(retrieval, {
    ...(opts.audit?.userId ? { userId: opts.audit.userId } : {}),
    ...(opts.audit?.runId ? { runId: opts.audit.runId } : {}),
    ...(opts.audit?.agentId ? { agentId: opts.audit.agentId } : {}),
  });

  return {
    retrieval,
    citations: retrieval.citations ?? [],
    evidence_quality: quality,
  };
}

export async function retrieveKnowledge(
  opts: RetrieveKnowledgeOptionsExt,
): Promise<RetrieveKnowledgeResult> {
  const { isRagEnabled } = await import("@/ai/runtime/feature-flags");
  if (!isRagEnabled()) {
    const retrieval_id = newRetrievalId();
    let retrieval: KnowledgeRetrieval = {
      retrieval_id,
      query: opts.query?.trim() ?? "",
      mode: opts.mode ?? "hybrid",
      hits: [],
      latency_ms: 0,
      created_at: new Date().toISOString(),
      rag_status: "skipped",
      retrieval_status: "skipped",
      evidence_available: false,
    };
    retrieval = enrichRetrieval(retrieval);
    return {
      retrieval,
      citations: [],
      evidence_quality: evaluateEvidenceQuality([]),
    };
  }

  const ragUser = opts.audit?.userId;
  if (ragUser) {
    const { checkAiRateLimits } = await import("@/ai/runtime/rate-limit");
    const rl = await checkAiRateLimits({ ragUserId: ragUser, userId: ragUser });
    if (!rl.ok) {
      const retrieval_id = newRetrievalId();
      let retrieval: KnowledgeRetrieval = {
        retrieval_id,
        query: opts.query?.trim() ?? "",
        mode: opts.mode ?? "hybrid",
        hits: [],
        latency_ms: 0,
        created_at: new Date().toISOString(),
        rag_status: "error",
        retrieval_status: "error",
        evidence_available: false,
      };
      retrieval = enrichRetrieval(retrieval);
      return {
        retrieval,
        citations: [],
        evidence_quality: evaluateEvidenceQuality([]),
      };
    }
  }

  const timeoutMs = opts.timeoutMs ?? 8_000;
  if (timeoutMs <= 0) {
    const retrieval_id = newRetrievalId();
    let retrieval: KnowledgeRetrieval = {
      retrieval_id,
      query: opts.query?.trim() ?? "",
      mode: opts.mode ?? "hybrid",
      hits: [],
      latency_ms: 0,
      created_at: new Date().toISOString(),
      rag_status: "timeout",
      retrieval_status: "timeout",
      evidence_available: false,
    };
    retrieval = enrichRetrieval(retrieval);
    return {
      retrieval,
      citations: [],
      evidence_quality: evaluateEvidenceQuality([]),
    };
  }
  try {
    return await withTimeout(retrieveKnowledgeInner(opts), timeoutMs);
  } catch (e) {
    if (e instanceof RagError && e.code === RAG_ERROR.EMPTY_QUERY) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("timeout");
    const isUnavailable =
      e instanceof RagError && e.code === RAG_ERROR.UNAVAILABLE
        ? true
        : msg.includes("RAG_UNAVAILABLE") || msg.includes("admin_db");
    const retrieval_id = newRetrievalId();
    const status: RagRuntimeStatus = isTimeout ? "timeout" : "error";
    let retrieval: KnowledgeRetrieval = {
      retrieval_id,
      query: opts.query?.trim() ?? "",
      mode: opts.mode ?? "hybrid",
      hits: [],
      latency_ms: 0,
      created_at: new Date().toISOString(),
      rag_status: status,
      retrieval_status: status,
      evidence_available: false,
      error_code: isUnavailable
        ? RAG_ERROR.UNAVAILABLE
        : isTimeout
          ? RAG_ERROR.TIMEOUT
          : RAG_ERROR.UNAVAILABLE,
      rag_availability: "RAG_UNAVAILABLE",
      citations: [],
      sources: [],
    };
    try {
      const { recordRagRetrieval } = await import("@/ai/governance/rag-retrieval-log");
      recordRagRetrieval(retrieval, {
        ...(opts.audit?.userId ? { userId: opts.audit.userId } : {}),
        ...(opts.audit?.runId ? { runId: opts.audit.runId } : {}),
        ...(opts.audit?.agentId ? { agentId: opts.audit.agentId } : {}),
      });
    } catch {
      /* ignore */
    }
    return {
      retrieval,
      citations: [],
      evidence_quality: evaluateEvidenceQuality([]),
    };
  }
}

export async function resolveKnowledgeRefs(
  kbRefs: string[],
  opts?: { topKPerRef?: number; asOf?: string },
): Promise<RetrieveKnowledgeResult> {
  const topK = opts?.topKPerRef ?? 3;
  const started = Date.now();
  const allHits: KnowledgeRetrievalHit[] = [];
  const seen = new Set<string>();
  let lastStatus: RagRuntimeStatus = "empty";

  for (const ref of kbRefs) {
    const partial = await retrieveKnowledge({
      query: ref.replace(/^kb:/, "").replace(/\./g, " "),
      kbRefs: [ref],
      topK,
      mode: "hybrid",
      ...(opts?.asOf ? { asOf: opts.asOf } : {}),
    });
    lastStatus = partial.retrieval.rag_status ?? lastStatus;
    for (const h of partial.retrieval.hits) {
      if (seen.has(h.chunk_id)) continue;
      seen.add(h.chunk_id);
      allHits.push(h);
    }
  }

  const retrieval_id = newRetrievalId();
  const ranked = rerankHits(allHits).slice(0, topK * Math.max(1, kbRefs.length));
  for (const h of ranked) {
    h.citation = buildCitation(h, retrieval_id);
  }
  const quality = evaluateEvidenceQuality(ranked);
  const status: RagRuntimeStatus =
    ranked.length === 0
      ? "empty"
      : lastStatus === "error" || lastStatus === "timeout"
        ? lastStatus
        : "ok";

  let retrieval: KnowledgeRetrieval = {
    retrieval_id,
    query: kbRefs.join(","),
    mode: "hybrid",
    hits: ranked,
    latency_ms: Date.now() - started,
    created_at: new Date().toISOString(),
    rag_status: status,
    retrieval_status: status,
    evidence_available: ranked.length > 0 && quality.evidence_adequate,
  };
  retrieval = enrichRetrieval(retrieval);

  return {
    retrieval,
    citations: retrieval.citations ?? [],
    evidence_quality: quality,
  };
}
