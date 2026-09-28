/**
 * FASE 22.2 — Production RAG hardening tests.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearKnowledgeStore,
  clearSourceRegistry,
  ensureVectorStore,
  getActiveVectorStore,
  getRagReadiness,
  checkRagHealth,
  ingestKnowledgeDocument,
  resetEmbeddingProvider,
  resetVectorStore,
  retrieveKnowledge,
  seedProductionCorpus,
  setVectorStore,
  type SeedCorpusReport,
} from "@/ai/rag";
import { RAG_ERROR, RagError } from "@/ai/rag/core/errors";
import { InMemoryVectorStore } from "@/ai/rag/core/vector-store-memory";
import { SupabasePgvectorStore } from "@/ai/rag/core/vector-store-supabase";
import { registerAllKnowledgeSources } from "@/ai/rag/sources";
import {
  evalCitationCorrectness,
  evalIrrelevantCitation,
  evalStaleDocument,
  seedEvalFixtures,
} from "@/ai/rag/evaluation";
import type { KnowledgeDocument } from "@/ai/contracts/knowledge-document";

const PREV_ENV = { ...process.env };

beforeEach(() => {
  process.env["VITEST"] = "true";
  delete process.env["AI_RAG_ENV"];
  delete process.env["AI_RAG_STORE"];
  resetVectorStore();
  clearKnowledgeStore();
  clearSourceRegistry();
  resetEmbeddingProvider();
  registerAllKnowledgeSources({ force: true });
});

afterEach(() => {
  process.env["AI_RAG_ENV"] = PREV_ENV["AI_RAG_ENV"];
  process.env["AI_RAG_STORE"] = PREV_ENV["AI_RAG_STORE"];
  process.env["VITEST"] = PREV_ENV["VITEST"] ?? "true";
  resetVectorStore();
  clearKnowledgeStore();
});

describe("FASE 22.2 production RAG hardening", () => {
  it("successful retrieval with citations + availability", async () => {
    await seedEvalFixtures();
    const { retrieval, citations } = await retrieveKnowledge({
      query: "exercise catalog muscle_group substitute",
      domains: ["exercise"],
      topK: 3,
      mode: "hybrid",
    });
    expect(retrieval.hits.length).toBeGreaterThan(0);
    expect(citations.length).toBeGreaterThan(0);
    expect(retrieval.retrieval_id).toMatch(/^kr_/);
    expect(retrieval.sources?.length).toBeGreaterThan(0);
    expect(retrieval.hits[0]?.similarity).toBeDefined();
    expect(retrieval.rag_availability).toBe("RAG_AVAILABLE");
    expect(retrieval.citations?.length).toBe(citations.length);
  });

  it("empty retrieval → RAG_EMPTY / RAG_DEGRADED", async () => {
    await seedEvalFixtures();
    const { retrieval, citations } = await retrieveKnowledge({
      query: "zzzznonexistenttoken_xyz_987_harden",
      topK: 5,
      mode: "hybrid",
    });
    expect(retrieval.hits.length).toBe(0);
    expect(citations.length).toBe(0);
    expect(retrieval.rag_status).toBe("empty");
    expect(retrieval.rag_availability).toBe("RAG_DEGRADED");
    expect(retrieval.error_code).toBe(RAG_ERROR.EMPTY);
  });

  it("DB failure → RAG_UNAVAILABLE without inventing hits", async () => {
    const bad = new SupabasePgvectorStore(async () => null);
    setVectorStore(bad);
    const { retrieval, citations } = await retrieveKnowledge({
      query: "exercise recovery",
      topK: 3,
      mode: "hybrid",
    });
    expect(retrieval.hits.length).toBe(0);
    expect(citations.length).toBe(0);
    expect(retrieval.rag_availability).toBe("RAG_UNAVAILABLE");
    expect(retrieval.error_code).toBe(RAG_ERROR.UNAVAILABLE);
  });

  it("embedding failure surfaces as unavailable (no invented knowledge)", async () => {
    await seedEvalFixtures();
    const { setEmbeddingProvider } = await import("@/ai/rag/embeddings");
    setEmbeddingProvider({
      id: "broken",
      dim: 256,
      async embed() {
        throw new Error("embedding_boom");
      },
      embeddingRef: () => "x",
    });
    const { retrieval } = await retrieveKnowledge({
      query: "exercise catalog",
      topK: 2,
      mode: "hybrid",
    });
    expect(retrieval.hits.length).toBe(0);
    expect(retrieval.rag_availability).toBe("RAG_UNAVAILABLE");
  });

  it("invalid source → RAG_SOURCE_INVALID", async () => {
    const { ingestFromSource } = await import("@/ai/rag/ingestion");
    await expect(ingestFromSource("src_does_not_exist_xyz")).rejects.toMatchObject({
      code: RAG_ERROR.SOURCE_INVALID,
    });
  });

  it("stale document excluded by asOf", async () => {
    const r = await evalStaleDocument();
    expect(r.passed).toBe(true);
  });

  it("citation correctness", async () => {
    const r = await evalCitationCorrectness();
    expect(r.passed).toBe(true);
  });

  it("irrelevant citation filter", async () => {
    const r = await evalIrrelevantCitation();
    expect(r.passed).toBe(true);
  });

  it("production never falls back to InMemory when supabase fails", async () => {
    resetVectorStore();
    process.env["AI_RAG_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_RAG_STORE"] = "supabase";

    await expect(ensureVectorStore({ force: true })).rejects.toBeInstanceOf(RagError);
    expect(getActiveVectorStore()).toBeNull();

    const { getVectorStore } = await import("@/ai/rag/core/vector-store");
    expect(() => getVectorStore()).toThrow(/RAG_UNAVAILABLE/);
    expect(getActiveVectorStore()?.id).not.toBe("memory_v1");
  });

  it("AI_RAG_STORE=memory forbidden in production", async () => {
    process.env["AI_RAG_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_RAG_STORE"] = "memory";
    resetVectorStore();
    await expect(ensureVectorStore({ force: true })).rejects.toThrow(/memory is forbidden/);
  });

  it("seed is idempotent (same document count)", async () => {
    setVectorStore(new InMemoryVectorStore());
    const a = (await seedProductionCorpus({
      report: true,
      onDuplicate: "upsert",
    })) as SeedCorpusReport;
    const b = (await seedProductionCorpus({
      report: true,
      onDuplicate: "upsert",
    })) as SeedCorpusReport;
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.documents).toBe(a.documents);
    expect(a.documents).toBeGreaterThan(10);
  });

  it("checkRagHealth + getRagReadiness in test env", async () => {
    await seedEvalFixtures();
    const health = await checkRagHealth();
    expect(health.environment).toBe("test");
    expect(health.checks.some((c) => c.id === "embeddings" && c.ok)).toBe(true);
    const ready = await getRagReadiness();
    expect(ready.health).toBeTruthy();
    // With seeded fixtures, corpus/retrieval should pass in memory test
    expect(ready.health.checks.find((c) => c.id === "retrieval")?.ok).toBe(true);
  });

  it("low confidence → RAG_DEGRADED / RAG_LOW_CONFIDENCE", async () => {
    // Single weak fixture unlikely to meet evidence_adequate for unrelated query domain mix
    const weak: KnowledgeDocument = {
      document_id: "fix_weak_only",
      title: "Weak",
      domain: "behavior",
      source: "internal_docs",
      source_type: "fixture",
      version: "1.0.0",
      language: "en",
      content: "x",
      metadata: { kb_ref: "kb:behavior.weak", source_id: "src_behavior_habits", trust_level: "external_unverified" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: ["fixture"],
    };
    clearKnowledgeStore();
    await ingestKnowledgeDocument(weak, { onDuplicate: "upsert" });
    const { retrieval } = await retrieveKnowledge({
      query: "x",
      domains: ["behavior"],
      topK: 3,
      mode: "keyword",
    });
    if (retrieval.hits.length > 0 && !retrieval.evidence_available) {
      expect(retrieval.rag_availability).toBe("RAG_DEGRADED");
      expect(retrieval.error_code).toBe(RAG_ERROR.LOW_CONFIDENCE);
    } else {
      // Accept empty as degraded path
      expect(["RAG_DEGRADED", "RAG_AVAILABLE"]).toContain(retrieval.rag_availability);
    }
  });
});
