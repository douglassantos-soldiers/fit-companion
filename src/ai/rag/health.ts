/**
 * FASE 22.2 — RAG health check + readiness.
 */

import { RAG_ERROR } from "@/ai/rag/core/errors";
import { ensureVectorStore, getActiveVectorStore } from "@/ai/rag/core/vector-store";
import { getEmbeddingProvider } from "@/ai/rag/embeddings";
import { expectedCorpusDocumentMin } from "@/ai/rag/ingestion";
import { resolveRagEnvironment, resolveRagStoreMode } from "@/ai/rag/runtime/env";
import { retrieveKnowledge } from "@/ai/rag/retrieval";

export type RagHealthCheckId =
  | "database"
  | "pgvector_tables"
  | "embeddings"
  | "corpus"
  | "retrieval"
  | "citation";

export type RagHealthCheckResult = {
  id: RagHealthCheckId;
  ok: boolean;
  detail?: string;
};

export type RagHealthReport = {
  ok: boolean;
  environment: ReturnType<typeof resolveRagEnvironment>;
  store_id: string | null;
  store_mode: string;
  checks: RagHealthCheckResult[];
  generated_at: string;
};

export type RagReadinessResult = {
  RAG_READY: boolean;
  reasons: string[];
  health: RagHealthReport;
};

export async function checkRagHealth(): Promise<RagHealthReport> {
  const environment = resolveRagEnvironment();
  const checks: RagHealthCheckResult[] = [];
  let storeId: string | null = null;
  let storeMode = "unknown";

  try {
    storeMode = resolveRagStoreMode(environment);
  } catch (e) {
    storeMode = "invalid";
    checks.push({
      id: "database",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // --- store / database ---
  try {
    const store = await ensureVectorStore();
    storeId = store.id;
    const pingOk = typeof store.ping === "function" ? await store.ping() : true;
    checks.push({
      id: "database",
      ok: pingOk,
      detail: pingOk ? `store=${store.id}` : "ping_failed",
    });
    checks.push({
      id: "pgvector_tables",
      ok: pingOk && (environment !== "production" || store.id === "supabase_pgvector_v1"),
      detail:
        environment === "production" && store.id !== "supabase_pgvector_v1"
          ? "production_requires_supabase"
          : store.id,
    });
  } catch (e) {
    checks.push({
      id: "database",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
    checks.push({
      id: "pgvector_tables",
      ok: false,
      detail: "store_unavailable",
    });
  }

  // --- embeddings ---
  try {
    const provider = getEmbeddingProvider();
    const emb = await provider.embed("rag health probe");
    checks.push({
      id: "embeddings",
      ok: Array.isArray(emb) && emb.length > 0,
      detail: `dim=${emb.length}`,
    });
  } catch (e) {
    checks.push({
      id: "embeddings",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // --- corpus ---
  try {
    const store = getActiveVectorStore() ?? (await ensureVectorStore());
    const size = typeof store.size === "function" ? await store.size() : 0;
    const min = expectedCorpusDocumentMin();
    checks.push({
      id: "corpus",
      ok: size >= min,
      detail: `docs=${size} min=${min} expected_corpus=${expectedCorpusDocumentMin()}`,
    });
  } catch (e) {
    checks.push({
      id: "corpus",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // --- retrieval + citation ---
  try {
    const { retrieval, citations } = await retrieveKnowledge({
      query: "exercise catalog muscle recovery sleep",
      topK: 3,
      mode: "hybrid",
      timeoutMs: 10_000,
    });
    const retrievalOk =
      retrieval.rag_status === "ok" ||
      retrieval.rag_status === "empty" ||
      retrieval.rag_availability === "RAG_DEGRADED";
    // empty corpus → degraded but retrieval path works; error/unavailable fails
    const pathOk =
      retrieval.rag_availability !== "RAG_UNAVAILABLE" &&
      retrieval.rag_status !== "error" &&
      retrieval.rag_status !== "timeout";
    checks.push({
      id: "retrieval",
      ok: pathOk && retrievalOk,
      detail: `status=${retrieval.rag_status} availability=${retrieval.rag_availability} hits=${retrieval.hits.length}`,
    });
    const citeOk =
      retrieval.hits.length === 0
        ? true // empty is not a citation failure
        : citations.length > 0 &&
          citations.every(
            (c) =>
              retrieval.hits.some((h) => h.chunk_id === c.chunk_id) &&
              Boolean(c.document_id),
          );
    checks.push({
      id: "citation",
      ok: citeOk,
      detail: `citations=${citations.length}`,
    });
  } catch (e) {
    checks.push({
      id: "retrieval",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
    checks.push({
      id: "citation",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const ok = checks.every((c) => c.ok);
  return {
    ok,
    environment,
    store_id: storeId,
    store_mode: storeMode,
    checks,
    generated_at: new Date().toISOString(),
  };
}

export async function getRagReadiness(): Promise<RagReadinessResult> {
  const health = await checkRagHealth();
  const reasons: string[] = [];
  const env = health.environment;

  if (env === "production") {
    if (health.store_id !== "supabase_pgvector_v1") {
      reasons.push("production_requires_supabase_pgvector");
    }
  }

  for (const c of health.checks) {
    if (!c.ok) reasons.push(`${c.id}:${c.detail ?? "fail"}`);
  }

  // Production: all checks required. Test/dev: database+embeddings+retrieval path enough if memory.
  let RAG_READY = health.ok && reasons.length === 0;
  if (env === "production" && health.store_id !== "supabase_pgvector_v1") {
    RAG_READY = false;
    if (!reasons.includes("production_requires_supabase_pgvector")) {
      reasons.push("production_requires_supabase_pgvector");
    }
  }

  if (!RAG_READY && reasons.length === 0) {
    reasons.push(RAG_ERROR.UNAVAILABLE);
  }

  return { RAG_READY, reasons, health };
}
