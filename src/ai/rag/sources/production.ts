/**
 * Curated product knowledge loaders — structured corpus in-repo (no web scraping).
 */

import type { KnowledgeDocument } from "@/ai/contracts/knowledge-document";
import type { KnowledgeSource } from "@/ai/contracts/knowledge-source";
import type { KnowledgeSourceAdapter } from "@/ai/rag/core/types";
import { PRODUCT_KNOWLEDGE_CORPUS } from "@/ai/rag/corpus/product-knowledge";

const NOW = "2026-03-11T12:00:00.000Z";
const EFFECTIVE = "2026-01-01";

const SOURCE_META: Record<
  string,
  { name: string; domain: KnowledgeDocument["domain"] }
> = {
  src_exercise_catalog_schema: {
    name: "Exercise / training catalog schema",
    domain: "exercise",
  },
  src_nutrition_labels: { name: "Nutrition labels and macros", domain: "nutrition" },
  src_recovery_checkin: { name: "Recovery check-in signals", domain: "recovery" },
  src_sleep_checkin: { name: "Sleep check-in fields", domain: "sleep" },
  src_behavior_habits: { name: "Behavior habits and adherence", domain: "behavior" },
  src_performance_os: { name: "Performance OS overview", domain: "performance" },
  src_supplementation_timing: { name: "Supplement timing", domain: "supplementation" },
  src_products_catalog: { name: "Products catalog schema", domain: "products" },
  src_coaching_faq: { name: "Coach FAQ deterministic", domain: "coaching" },
};

function makeSource(sourceId: string): KnowledgeSource {
  const meta = SOURCE_META[sourceId] ?? {
    name: sourceId,
    domain: "coaching" as const,
  };
  return {
    source_id: sourceId,
    name: meta.name,
    domain: meta.domain,
    type: "structured",
    source_type: "structured",
    publisher: "Soldiers Fit Companion",
    version: "1.0.0",
    reference: `src/ai/rag/corpus/product-knowledge.ts#${sourceId}`,
    license: "proprietary-internal",
    status: "active",
    created_at: NOW,
    updated_at: NOW,
    trust_level: "curated",
    trust_tier: "curated",
    effective_date: EFFECTIVE,
    expiration_date: null,
  };
}

function rowToDocument(row: (typeof PRODUCT_KNOWLEDGE_CORPUS)[number]): KnowledgeDocument {
  return {
    document_id: row.document_id,
    title: row.title,
    domain: row.domain,
    source: "internal_docs",
    source_type: "structured",
    version: "1.0.0",
    language: "pt-BR",
    content: row.content,
    source_id: row.source_key,
    status: "active",
    effective_date: EFFECTIVE,
    expiration_date: null,
    created_at: NOW,
    updated_at: NOW,
    metadata: {
      source_id: row.source_key,
      kb_ref: row.kb_ref,
      section: row.section,
      document_version: "1.0.0",
      trust_level: "curated",
      effective_date: EFFECTIVE,
    },
    tags: [row.kb_ref, row.domain],
  };
}

export function buildProductionSourceAdapters(): KnowledgeSourceAdapter[] {
  const bySource = new Map<string, typeof PRODUCT_KNOWLEDGE_CORPUS>();
  for (const row of PRODUCT_KNOWLEDGE_CORPUS) {
    const list = bySource.get(row.source_key) ?? [];
    list.push(row);
    bySource.set(row.source_key, list);
  }
  return [...bySource.entries()].map(([sourceId, rows]) => ({
    source: makeSource(sourceId),
    loadDocuments: async () => rows.map(rowToDocument),
  }));
}

export function listConnectedSourceIds(): string[] {
  return Object.keys(SOURCE_META);
}
