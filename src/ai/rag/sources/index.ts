/**
 * Domain source adapters — empty until real catalogs / Content OS / curated markdown.
 * Do NOT invent scientific content here.
 */

import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import { KNOWLEDGE_DOMAINS } from "@/ai/contracts/knowledge-document";
import type { KnowledgeSource } from "@/ai/contracts/knowledge-source";
import { clearSourceRegistry, registerSourceAdapter } from "@/ai/rag/core/registry";
import type { KnowledgeSourceAdapter } from "@/ai/rag/core/types";

function emptyAdapter(domain: KnowledgeDomain): KnowledgeSourceAdapter {
  const source: KnowledgeSource = {
    source_id: `src_${domain}_placeholder`,
    name: `${domain} knowledge (placeholder)`,
    source_type: "manual",
    domain,
    trust_tier: "internal",
    version: "0.0.0",
    metadata: {
      status: "awaiting_real_sources",
      note: "wire catalog / Content OS / curated markdown — no fictional science",
    },
  };
  return {
    source,
    loadDocuments: async () => [],
  };
}

let bootstrapped = false;

export function registerAllKnowledgeSources(opts?: { force?: boolean }): void {
  if (bootstrapped && !opts?.force) return;
  if (opts?.force) {
    clearSourceRegistry();
    bootstrapped = false;
  }
  for (const domain of KNOWLEDGE_DOMAINS) {
    registerSourceAdapter(emptyAdapter(domain));
  }
  bootstrapped = true;
}

export function createFixtureSourceAdapter(
  source: KnowledgeSource,
  // Fixtures only for tests — never production scientific claims
  loader: KnowledgeSourceAdapter["loadDocuments"],
): KnowledgeSourceAdapter {
  return { source, loadDocuments: loader };
}
