/**
 * Allowlisted Soldiers knowledge Markdown → KnowledgeDocument[].
 * Loads from docs/knowledge/ (fixed paths only). Never loads policy/spec.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { KnowledgeDocument } from "@/ai/contracts/knowledge-document";
import {
  markdownToKnowledgeDocuments,
  type SoldiersKnowledgeSpec,
} from "@/ai/rag/ingestion/markdown-knowledge";

/** Parent doc_ids that may be indexed (never evidence-policy / spec). */
export const SOLDIERS_RAG_DOC_IDS = [
  "tkd-resistido-adultos-001",
  "nutrition-knowledge-001",
  "supplements-knowledge-001",
  "safety-knowledge-001",
] as const;

export const SOLDIERS_RAG_BLOCKED_DOC_IDS = [
  "evidence-policy-001",
  "spec-training-system-001",
] as const;

export const SOLDIERS_KNOWLEDGE_SPECS: readonly SoldiersKnowledgeSpec[] = [
  {
    filename: "tkd-resistido-adultos-001.md",
    doc_id: "tkd-resistido-adultos-001",
    domain: "training",
    kb_ref: "kb:tkd.resistido",
    source_id: "src_soldiers_tkd",
  },
  {
    filename: "nutrition-knowledge-001.md",
    doc_id: "nutrition-knowledge-001",
    domain: "nutrition",
    kb_ref: "kb:nutrition.knowledge",
    source_id: "src_soldiers_nutrition",
  },
  {
    filename: "supplements-knowledge-001.md",
    doc_id: "supplements-knowledge-001",
    domain: "supplementation",
    kb_ref: "kb:supplements.knowledge",
    source_id: "src_soldiers_supplements",
  },
  {
    filename: "safety-knowledge-001.md",
    doc_id: "safety-knowledge-001",
    domain: "coaching",
    kb_ref: "kb:safety.knowledge",
    source_id: "src_soldiers_safety",
  },
] as const;

function knowledgeDir(): string {
  return join(process.cwd(), "docs", "knowledge");
}

export function loadSoldiersKnowledgeDocuments(): KnowledgeDocument[] {
  const dir = knowledgeDir();
  const out: KnowledgeDocument[] = [];
  for (const spec of SOLDIERS_KNOWLEDGE_SPECS) {
    const raw = readFileSync(join(dir, spec.filename), "utf8");
    out.push(...markdownToKnowledgeDocuments(raw, spec));
  }
  return out;
}

export function soldiersKnowledgeSourceIds(): string[] {
  return SOLDIERS_KNOWLEDGE_SPECS.map((s) => s.source_id);
}

export function isSoldiersRagParentDocId(id: string): boolean {
  return (SOLDIERS_RAG_DOC_IDS as readonly string[]).includes(id);
}

export function isBlockedFromRagDocId(id: string): boolean {
  return (SOLDIERS_RAG_BLOCKED_DOC_IDS as readonly string[]).includes(id);
}
