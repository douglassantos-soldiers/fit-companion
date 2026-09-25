/**
 * RAG infrastructure — unit tests (fixtures only, no scientific corpus).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  EVAL_FIXTURES,
  KNOWLEDGE_DOMAINS,
  RAG_ERROR,
  RagError,
  clearKnowledgeStore,
  getCitationsFromRetrieval,
  ingestKnowledgeDocument,
  listKnowledgeDocuments,
  listKnowledgeSources,
  registerAllKnowledgeSources,
  resetEmbeddingProvider,
  resolveKnowledgeRefs,
  retrieveKnowledge,
  runRagEvaluation,
  seedEvalFixtures,
} from "@/ai/rag";

beforeEach(() => {
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerAllKnowledgeSources({ force: true });
});

describe("RAG Infrastructure", () => {
  it("registers 9 domain source placeholders", () => {
    const sources = listKnowledgeSources();
    expect(sources.length).toBe(KNOWLEDGE_DOMAINS.length);
    expect(new Set(sources.map((s) => s.domain))).toEqual(new Set(KNOWLEDGE_DOMAINS));
  });

  it("production placeholders load zero documents", async () => {
    const { ingestFromSource } = await import("@/ai/rag");
    const results = await ingestFromSource("src_exercise_placeholder");
    expect(results).toEqual([]);
    expect(listKnowledgeDocuments()).toHaveLength(0);
  });

  it("ingests fixture docs and retrieves with citations", async () => {
    await seedEvalFixtures();
    expect(listKnowledgeDocuments()).toHaveLength(EVAL_FIXTURES.length);

    const { retrieval, citations } = await retrieveKnowledge({
      query: "nutrition protein_g barcode label fields",
      domains: ["nutrition"],
      mode: "hybrid",
      topK: 3,
    });
    expect(retrieval.hits.length).toBeGreaterThan(0);
    expect(retrieval.hits[0]!.domain).toBe("nutrition");
    expect(citations.length).toBe(retrieval.hits.length);
    expect(citations[0]!.document_id).toBeTruthy();
    expect(citations[0]!.excerpt).toBeTruthy();
  });

  it("supports keyword mode and semantic mode", async () => {
    await seedEvalFixtures();
    const kw = await retrieveKnowledge({
      query: "Sleep check-in fields hours quality_score",
      mode: "keyword",
      topK: 2,
    });
    expect(kw.retrieval.hits.some((h) => h.document_id === "fix_sleep_checkin_fields")).toBe(true);

    const sem = await retrieveKnowledge({
      query: "muscle equipment substitute catalog schema",
      mode: "semantic",
      domains: ["exercise"],
      topK: 2,
    });
    expect(sem.retrieval.hits.length).toBeGreaterThan(0);
  });

  it("filters by metadata kb_ref via resolveKnowledgeRefs", async () => {
    await seedEvalFixtures();
    const { citations } = await resolveKnowledgeRefs(["kb:exercise.catalog"]);
    expect(citations.length).toBeGreaterThan(0);
    expect(citations.every((c) => c.document_id === "fix_exercise_catalog_schema")).toBe(true);
  });

  it("rejects invalid documents and empty query", async () => {
    await expect(
      ingestKnowledgeDocument({
        document_id: "",
        title: "x",
        domain: "exercise",
        source: "internal_docs",
        source_type: "fixture",
        version: "1",
        language: "en",
        content: "body",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(RagError);

    await expect(retrieveKnowledge({ query: "  " })).rejects.toMatchObject({
      code: RAG_ERROR.EMPTY_QUERY,
    });
  });

  it("getCitationsFromRetrieval tracks sources", async () => {
    await seedEvalFixtures();
    const { retrieval } = await retrieveKnowledge({
      query: "exercise catalog",
      domains: ["exercise"],
    });
    const cites = getCitationsFromRetrieval(retrieval);
    expect(cites.every((c) => c.citation_id && c.chunk_id && c.title)).toBe(true);
  });

  it("evaluation suite passes", async () => {
    const results = await runRagEvaluation();
    expect(results.every((r) => r.passed)).toBe(true);
    expect(results.map((r) => r.name)).toEqual([
      "retrieval_relevance",
      "source_quality",
      "empty_retrieval",
      "wrong_domain_retrieval",
      "duplicate_documents",
    ]);
  });
});
