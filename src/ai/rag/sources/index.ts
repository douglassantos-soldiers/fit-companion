/**
 * Domain source adapters — curated product corpus (FASE 16). No web scraping.
 */

import { clearSourceRegistry, registerSourceAdapter } from "@/ai/rag/core/registry";
import type { KnowledgeSourceAdapter } from "@/ai/rag/core/types";
import type { KnowledgeSource } from "@/ai/contracts/knowledge-source";
import {
  buildProductionSourceAdapters,
  listConnectedSourceIds,
} from "@/ai/rag/sources/production";

let bootstrapped = false;

export function registerAllKnowledgeSources(opts?: { force?: boolean }): void {
  if (bootstrapped && !opts?.force) return;
  if (opts?.force) {
    clearSourceRegistry();
    bootstrapped = false;
  }
  for (const adapter of buildProductionSourceAdapters()) {
    registerSourceAdapter(adapter);
  }
  bootstrapped = true;
}

export function createFixtureSourceAdapter(
  source: KnowledgeSource,
  loader: KnowledgeSourceAdapter["loadDocuments"],
): KnowledgeSourceAdapter {
  return { source, loadDocuments: loader };
}

export { listConnectedSourceIds };
