/**
 * Register RAG sources and optionally seed curated corpus into VectorStore.
 */

import { registerAllKnowledgeSources } from "@/ai/rag/sources";

export function registerRagInfrastructure(opts?: {
  force?: boolean;
  /** When true, ingest all production curated sources (in-memory by default). */
  seedCorpus?: boolean;
}): void {
  registerAllKnowledgeSources(opts);
  if (opts?.seedCorpus) {
    void import("@/ai/rag/ingestion").then((m) => m.seedProductionCorpus()).catch(() => {});
  }
}
