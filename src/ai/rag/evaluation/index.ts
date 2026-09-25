/**
 * RAG evaluation harness — relevance, source quality, empty, wrong domain, duplicates.
 * Uses synthetic fixture documents only (not scientific claims).
 */

import type { KnowledgeDocument } from "@/ai/contracts/knowledge-document";
import { clearKnowledgeStore, listKnowledgeDocuments } from "@/ai/rag/core/store";
import { resetEmbeddingProvider } from "@/ai/rag/embeddings";
import { ingestKnowledgeDocument } from "@/ai/rag/ingestion";
import { retrieveKnowledge } from "@/ai/rag/retrieval";
import { registerAllKnowledgeSources } from "@/ai/rag/sources";

export type EvalCaseResult = {
  name: string;
  passed: boolean;
  detail?: string;
};

function fixtureDoc(
  partial: Pick<KnowledgeDocument, "document_id" | "title" | "domain" | "content"> &
    Partial<KnowledgeDocument>,
): KnowledgeDocument {
  const now = new Date().toISOString();
  return {
    document_id: partial.document_id,
    title: partial.title,
    domain: partial.domain,
    source: partial.source ?? "internal_docs",
    source_type: partial.source_type ?? "fixture",
    version: partial.version ?? "1.0.0",
    language: partial.language ?? "en",
    content: partial.content,
    metadata: {
      kb_ref: partial.metadata?.["kb_ref"] ?? `kb:${partial.domain}.fixture`,
      source_id: partial.metadata?.["source_id"] ?? `src_${partial.domain}_placeholder`,
      ...(partial.metadata ?? {}),
    },
    created_at: partial.created_at ?? now,
    updated_at: partial.updated_at ?? now,
    tags: partial.tags ?? ["fixture"],
  };
}

/** Product/schema-style fixtures — not scientific literature. */
export const EVAL_FIXTURES: KnowledgeDocument[] = [
  fixtureDoc({
    document_id: "fix_exercise_catalog_schema",
    title: "Exercise catalog field schema",
    domain: "exercise",
    content:
      "Product schema: exercise_id, muscle_group, equipment, substitute_group. Used by catalog tooling.",
    metadata: { kb_ref: "kb:exercise.catalog", trust_note: "fixture_schema" },
  }),
  fixtureDoc({
    document_id: "fix_nutrition_label_fields",
    title: "Nutrition label field map",
    domain: "nutrition",
    content:
      "Product schema: protein_g, carbs_g, fat_g, kcal. Meal logging maps barcode labels to these fields.",
    metadata: { kb_ref: "kb:nutrition.labels" },
  }),
  fixtureDoc({
    document_id: "fix_sleep_checkin_fields",
    title: "Sleep check-in fields",
    domain: "sleep",
    content:
      "Product schema: hours, quality_score, source checkin|wearable. Coach UI binds these keys.",
    metadata: { kb_ref: "kb:sleep.checkin" },
  }),
];

export async function seedEvalFixtures(): Promise<void> {
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerAllKnowledgeSources({ force: true });
  for (const doc of EVAL_FIXTURES) {
    await ingestKnowledgeDocument(doc, { onDuplicate: "upsert" });
  }
}

export async function evalRetrievalRelevance(): Promise<EvalCaseResult> {
  await seedEvalFixtures();
  const { retrieval, citations } = await retrieveKnowledge({
    query: "exercise catalog muscle_group substitute",
    domains: ["exercise"],
    topK: 3,
    mode: "hybrid",
  });
  const hit = retrieval.hits.some((h) => h.document_id === "fix_exercise_catalog_schema");
  const cited = citations.some((c) => c.document_id === "fix_exercise_catalog_schema");
  return {
    name: "retrieval_relevance",
    passed: hit && cited && citations.length > 0,
    detail: hit ? "expected doc ranked" : "missing expected doc",
  };
}

export async function evalSourceQuality(): Promise<EvalCaseResult> {
  await seedEvalFixtures();
  const docs = listKnowledgeDocuments();
  const allFixture = docs.every((d) => d.source_type === "fixture" && d.source === "internal_docs");
  const hasTrustMeta = docs.every((d) => d.tags?.includes("fixture"));
  return {
    name: "source_quality",
    passed: allFixture && hasTrustMeta && docs.length === EVAL_FIXTURES.length,
    detail: `docs=${docs.length}`,
  };
}

export async function evalEmptyRetrieval(): Promise<EvalCaseResult> {
  await seedEvalFixtures();
  const { retrieval, citations } = await retrieveKnowledge({
    query: "zzzznonexistenttoken_xyz_987",
    topK: 5,
    mode: "hybrid",
  });
  return {
    name: "empty_retrieval",
    passed: retrieval.hits.length === 0 && citations.length === 0,
    detail: `hits=${retrieval.hits.length}`,
  };
}

export async function evalWrongDomainRetrieval(): Promise<EvalCaseResult> {
  await seedEvalFixtures();
  const { retrieval } = await retrieveKnowledge({
    query: "exercise catalog muscle_group",
    domains: ["nutrition"],
    topK: 5,
    mode: "hybrid",
  });
  const leaked = retrieval.hits.some((h) => h.domain === "exercise");
  return {
    name: "wrong_domain_retrieval",
    passed: !leaked,
    detail: leaked ? "domain filter leaked" : "filter ok",
  };
}

export async function evalDuplicateDocuments(): Promise<EvalCaseResult> {
  await seedEvalFixtures();
  const dup = EVAL_FIXTURES[0]!;
  let rejectOk = false;
  try {
    await ingestKnowledgeDocument(dup, { onDuplicate: "reject" });
  } catch {
    rejectOk = true;
  }
  const upsert = await ingestKnowledgeDocument(
    { ...dup, content: `${dup.content}\n\nUpdated schema note.`, version: "1.0.1" },
    { onDuplicate: "upsert" },
  );
  const docs = listKnowledgeDocuments("exercise");
  const one = docs.filter((d) => d.document_id === dup.document_id).length === 1;
  return {
    name: "duplicate_documents",
    passed: rejectOk && upsert.upserted && one,
    detail: `reject=${rejectOk} upserted=${upsert.upserted}`,
  };
}

export async function runRagEvaluation(): Promise<EvalCaseResult[]> {
  return [
    await evalRetrievalRelevance(),
    await evalSourceQuality(),
    await evalEmptyRetrieval(),
    await evalWrongDomainRetrieval(),
    await evalDuplicateDocuments(),
  ];
}
