/**
 * In-memory RAG retrieval audit log + governance mirror.
 */
import type { KnowledgeRetrieval } from "@/ai/contracts/knowledge-retrieval";
import { recordAudit } from "@/ai/governance/audit";

const MAX = 500;
const buffer: KnowledgeRetrieval[] = [];

export function recordRagRetrieval(
  retrieval: KnowledgeRetrieval,
  extras?: {
    userId?: string;
    runId?: string;
    agentId?: string;
    status?: string;
  },
): void {
  buffer.push(retrieval);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);

  const top = retrieval.hits[0];
  recordAudit({
    kind: "rag_retrieval",
    user_id: extras?.userId ?? "system",
    subject_id: retrieval.retrieval_id,
    retrieval_id: retrieval.retrieval_id,
    ...(extras?.runId ? { run_id: extras.runId } : {}),
    ...(extras?.agentId ? { agent_id: extras.agentId } : {}),
    status: extras?.status ?? (retrieval.hits.length > 0 ? "hit" : "miss"),
    latency_ms: retrieval.latency_ms,
    created_at: retrieval.created_at,
    summary: `hits=${retrieval.hits.length} mode=${retrieval.mode}`,
    metadata: {
      hit_count: retrieval.hits.length,
      mode: retrieval.mode,
      top_score: top?.score ?? 0,
      top_document_id: top?.document_id ?? null,
      top_source_id: top?.source_id ?? null,
      query_len: retrieval.query.length,
    },
  });
}

export function listRagRetrievals(limit = 50): KnowledgeRetrieval[] {
  return buffer.slice(-Math.max(1, limit));
}

export function clearRagRetrievalLog(): void {
  buffer.length = 0;
}

export function findRagRetrieval(retrievalId: string): KnowledgeRetrieval | undefined {
  return buffer.find((r) => r.retrieval_id === retrievalId);
}
