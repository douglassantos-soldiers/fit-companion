/**
 * Knowledge source adapter registry.
 */

import type { KnowledgeSource } from "@/ai/contracts/knowledge-source";
import { RAG_ERROR, RagError } from "@/ai/rag/core/errors";
import type { KnowledgeSourceAdapter } from "@/ai/rag/core/types";

const adapters = new Map<string, KnowledgeSourceAdapter>();

export function clearSourceRegistry(): void {
  adapters.clear();
}

export function registerSourceAdapter(adapter: KnowledgeSourceAdapter): void {
  adapters.set(adapter.source.source_id, adapter);
}

export function getSourceAdapter(sourceId: string): KnowledgeSourceAdapter | undefined {
  return adapters.get(sourceId);
}

export function listSourceAdapters(): KnowledgeSourceAdapter[] {
  return [...adapters.values()];
}

export function listKnowledgeSources(): KnowledgeSource[] {
  return listSourceAdapters().map((a) => a.source);
}

export function requireSourceAdapter(sourceId: string): KnowledgeSourceAdapter {
  const a = adapters.get(sourceId);
  if (!a) throw new RagError(RAG_ERROR.UNKNOWN_SOURCE, `unknown_source:${sourceId}`);
  return a;
}
