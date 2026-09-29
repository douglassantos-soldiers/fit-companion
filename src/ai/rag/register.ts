/**
 * Register RAG sources. FASE 23.4 — production seed is NOT fire-and-forget.
 * Use initializeAIInfrastructure({ seedRag: true }) or `npm run rag:seed`.
 */

import { registerAllKnowledgeSources } from "@/ai/rag/sources";
import { resolveRagEnvironment } from "@/ai/rag/runtime/env";

export type RegisterRagResult = {
  registered: true;
  /** True only when seed was started via explicit await path (legacy flag kept for callers). */
  seed_started?: boolean;
  seed_error?: string;
  deferred_to_initializer?: boolean;
};

export function registerRagInfrastructure(opts?: {
  force?: boolean;
  /** When true, ingest curated corpus synchronously (awaited by caller via ensure path). */
  seedCorpus?: boolean;
}): RegisterRagResult {
  registerAllKnowledgeSources(opts);
  const env = resolveRagEnvironment();

  // FASE 23: never fire-and-forget seed in production.
  // Sources are registered sync; corpus seed goes through initializeAIInfrastructure / rag:seed.
  if (opts?.seedCorpus === true) {
    return { registered: true, seed_started: false, deferred_to_initializer: true };
  }

  if (env === "production" && typeof window === "undefined") {
    return { registered: true, deferred_to_initializer: true };
  }

  return { registered: true };
}
