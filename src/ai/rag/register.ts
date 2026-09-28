/**
 * Register RAG sources and optionally seed curated corpus into VectorStore.
 * FASE 22.2 — production bootstrap may auto-seed; errors are explicit (not swallowed).
 */

import { registerAllKnowledgeSources } from "@/ai/rag/sources";
import { resolveRagEnvironment } from "@/ai/rag/runtime/env";

export type RegisterRagResult = {
  registered: true;
  seed_started?: boolean;
  seed_error?: string;
};

export function registerRagInfrastructure(opts?: {
  force?: boolean;
  /** When true, ingest all production curated sources. */
  seedCorpus?: boolean;
}): RegisterRagResult {
  registerAllKnowledgeSources(opts);
  const env = resolveRagEnvironment();
  const shouldSeed =
    opts?.seedCorpus === true ||
    (opts?.seedCorpus !== false && env === "production" && typeof window === "undefined");

  if (!shouldSeed) {
    return { registered: true };
  }

  // Fire-and-forget but log failure explicitly (no silent swallow of empty catch)
  void (async () => {
    try {
      const { ensureVectorStore } = await import("@/ai/rag/core/vector-store");
      await ensureVectorStore();
      const { ensureCorpusSeeded } = await import("@/ai/rag/ingestion");
      const report = await ensureCorpusSeeded();
      if (report && !report.ok) {
        console.error("[rag] corpus seed failed:", report.error ?? "unknown");
      }
    } catch (e) {
      console.error(
        "[rag] production bootstrap seed error:",
        e instanceof Error ? e.message : String(e),
      );
    }
  })();

  return { registered: true, seed_started: true };
}
