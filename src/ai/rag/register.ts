/**
 * Register RAG placeholders (empty domain sources).
 */

import { registerAllKnowledgeSources } from "@/ai/rag/sources";

export function registerRagInfrastructure(opts?: { force?: boolean }): void {
  registerAllKnowledgeSources(opts);
}
