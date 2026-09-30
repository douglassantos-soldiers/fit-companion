// @ts-nocheck
/**
 * RAG infrastructure — unit tests (fixtures + production corpus).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  EVAL_FIXTURES,
  RAG_ERROR,
  RagError,
  clearKnowledgeStore,
  ingestFromSource,
  ingestKnowledgeDocument,
  listConnectedSourceIds,
  listKnowledgeDocuments,
  listKnowledgeSources,
  registerAllKnowledgeSources,
  resetEmbeddingProvider,
  resetVectorStore,
  resolveKnowledgeRefs,
  retrieveKnowledge,
  runRagEvaluation,
  seedEvalFixtures,
  seedProductionCorpus,
} from "@/ai/rag";

beforeEach(() => {
  resetVectorStore();
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerAllKnowledgeSources({ force: true });
});

describe("RAG Infrastructure", () => {
  it("registers curated production sources", () => {
    const sources = listKnowledgeSources();
    const ids = listConnectedSourceIds();
    expect(sources.length).toBe(ids.length);
    expect(sources.every((s) => s.status === "active")).toBe(true);
    expect(
      sources.every(
        (s) => s.trust_level === "curated" || s.trust_level === "internal",
      ),
    ).toBe(true);
  });

  it("production adapters return curated documents", async () => {
    const results = await ingestFromSource("src_nutrition_labels");
    expect(results.length).toBeGreaterThan(0);
    expect(listKnowledgeDocuments("nutrition").length).toBeGreaterThan(0);
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
    expect(retrieval.rag_status).toBeTruthy();
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

    await expect(retrieveKnowledge({ query: "   " })).rejects.toMatchObject({
      code: RAG_ERROR.EMPTY_QUERY,
    });
  });

  it("runRagEvaluation passes on fixtures", async () => {
    const suite = await runRagEvaluation();
    expect(suite.every((c) => c.passed)).toBe(true);
  });

  it("seedProductionCorpus indexes curated knowledge", async () => {
    const results = await seedProductionCorpus();
    expect(results.length).toBeGreaterThan(5);
    const { retrieval } = await retrieveKnowledge({
      query: "Decision Engine Living Plan Proposal",
      domains: ["performance"],
      topK: 3,
    });
    expect(retrieval.hits.length).toBeGreaterThan(0);
    expect(retrieval.hits[0]!.source_id).toBe("src_performance_os");
  });
});
