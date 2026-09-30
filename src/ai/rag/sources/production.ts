/**
 * Curated product knowledge loaders — FASE 16 structured corpus + Soldiers KB Markdown allowlist.
 */

import type { KnowledgeDocument } from "@/ai/contracts/knowledge-document";
import type { KnowledgeSource } from "@/ai/contracts/knowledge-source";
import type { KnowledgeSourceAdapter } from "@/ai/rag/core/types";
import { PRODUCT_KNOWLEDGE_CORPUS } from "@/ai/rag/corpus/product-knowledge";
import {
  loadSoldiersKnowledgeDocuments,
  SOLDIERS_KNOWLEDGE_SPECS,
  soldiersKnowledgeSourceIds,
} from "@/ai/rag/corpus/soldiers-knowledge";

const NOW = "2026-03-11T12:00:00.000Z";
const EFFECTIVE = "2026-01-01";

const SOURCE_META: Record<
  string,
  { name: string; domain: KnowledgeDocument["domain"]; trust?: "curated" | "draft_internal" }
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
  src_soldiers_tkd: {
    name: "TKD resistido adultos",
    domain: "training",
    trust: "draft_internal",
  },
  src_soldiers_nutrition: {
    name: "Nutrition knowledge Soldiers",
    domain: "nutrition",
    trust: "draft_internal",
  },
  src_soldiers_supplements: {
    name: "Supplements knowledge Soldiers",
    domain: "supplementation",
    trust: "draft_internal",
  },
  src_soldiers_safety: {
    name: "Safety knowledge Soldiers",
    domain: "coaching",
    trust: "draft_internal",
  },
};

function makeSource(sourceId: string): KnowledgeSource {
  const meta = SOURCE_META[sourceId] ?? {
    name: sourceId,
    domain: "coaching" as const,
  };
  const trust = meta.trust ?? "curated";
  const isSoldiers = sourceId.startsWith("src_soldiers_");
  return {
    source_id: sourceId,
    name: meta.name,
    domain: meta.domain,
    type: isSoldiers ? "markdown" : "structured",
    source_type: isSoldiers ? "markdown" : "structured",
    publisher: "Soldiers Fit Companion",
    version: "1.0.0",
    reference: isSoldiers
      ? `docs/knowledge/#${sourceId}`
      : `src/ai/rag/corpus/product-knowledge.ts#${sourceId}`,
    license: "proprietary-internal",
    status: "active",
    created_at: NOW,
    updated_at: NOW,
    trust_level: trust === "draft_internal" ? "internal" : "curated",
    trust_tier: trust === "draft_internal" ? "internal" : "curated",
    effective_date: isSoldiers ? "2026-09-29" : EFFECTIVE,
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
  const structured: KnowledgeSourceAdapter[] = [...bySource.entries()].map(
    ([sourceId, rows]) => ({
      source: makeSource(sourceId),
      loadDocuments: async () => rows.map(rowToDocument),
    }),
  );

  const soldiersBySource = new Map<string, KnowledgeDocument[]>();
  // Lazy: load once when first adapter runs; share cache across adapters.
  let cache: KnowledgeDocument[] | null = null;
  const ensureSoldiers = (): KnowledgeDocument[] => {
    if (!cache) cache = loadSoldiersKnowledgeDocuments();
    return cache;
  };

  for (const spec of SOLDIERS_KNOWLEDGE_SPECS) {
    soldiersBySource.set(spec.source_id, []);
  }

  const soldiersAdapters: KnowledgeSourceAdapter[] = SOLDIERS_KNOWLEDGE_SPECS.map((spec) => ({
    source: makeSource(spec.source_id),
    loadDocuments: async () =>
      ensureSoldiers().filter((d) => d.source_id === spec.source_id),
  }));

  return [...structured, ...soldiersAdapters];
}

export function listConnectedSourceIds(): string[] {
  return [...Object.keys(SOURCE_META), ...soldiersKnowledgeSourceIds()].filter(
    (id, i, arr) => arr.indexOf(id) === i,
  );
}
