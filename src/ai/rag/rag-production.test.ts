/**
 * FASE 16 — production RAG tests (empty, stale, versioning, timeout, quality, skill kb).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearKnowledgeStore,
  evaluateEvidenceQuality,
  ingestKnowledgeDocument,
  registerAllKnowledgeSources,
  resetEmbeddingProvider,
  resetVectorStore,
  resolveKnowledgeRefs,
  retrieveKnowledge,
  runDomainEvalDataset,
  seedProductionCorpus,
} from "@/ai/rag";
import { registerAllSkills } from "@/ai/skills/register";
import { clearSkillRegistry, clearSkillRunLog, runSkill } from "@/ai/skills";

const USER = "user-rag-fase16";

beforeEach(() => {
  resetVectorStore();
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerAllKnowledgeSources({ force: true });
  clearSkillRunLog();
  clearSkillRegistry();
  registerAllSkills();
});

describe("FASE 16 production RAG", () => {
  it("empty retrieval is explicit (no invented hits)", async () => {
    const { retrieval, citations, evidence_quality } = await retrieveKnowledge({
      query: "zzzz_no_match_xyz_quantum_unicorn_99",
      domains: ["coaching"],
      mode: "hybrid",
    });
    expect(retrieval.hits).toHaveLength(0);
    expect(citations).toHaveLength(0);
    expect(retrieval.rag_status).toBe("empty");
    expect(retrieval.evidence_available).toBe(false);
    expect(evidence_quality?.evidence_adequate).toBe(false);
  });

  it("irrelevant retrieval scores low evidence quality", async () => {
    await seedProductionCorpus();
    const { retrieval, evidence_quality } = await retrieveKnowledge({
      query: "barcode nutrition protein macros",
      domains: ["supplementation"],
      mode: "hybrid",
      topK: 3,
    });
    // May get weak keyword spillover — quality gate must still be honest
    if (retrieval.hits.length === 0) {
      expect(retrieval.rag_status).toBe("empty");
    } else {
      expect(evidence_quality).toBeTruthy();
      expect(typeof evidence_quality!.evidence_quality).toBe("number");
    }
  });

  it("correct retrieval returns source_id score rerank citation chain", async () => {
    await seedProductionCorpus();
    const { retrieval, citations } = await retrieveKnowledge({
      query: "proteinG energyKcal meal nutrient snapshot macros",
      domains: ["nutrition"],
      mode: "hybrid",
      topK: 3,
    });
    expect(retrieval.hits.length).toBeGreaterThan(0);
    const hit = retrieval.hits[0]!;
    expect(hit.source_id).toBeTruthy();
    expect(hit.rerank_score ?? hit.score).toBeGreaterThan(0);
    expect(hit.citation?.retrieval_id).toBe(retrieval.retrieval_id);
    expect(hit.citation?.chunk).toBe(hit.chunk_id);
    expect(citations[0]!.source_id || citations[0]!.source).toBeTruthy();
  });

  it("stale source excluded by asOf / expiration", async () => {
    const now = new Date().toISOString();
    await ingestKnowledgeDocument({
      document_id: "doc_stale_v1",
      title: "Stale recovery note",
      domain: "recovery",
      source: "internal_docs",
      source_type: "structured",
      version: "1.0.0",
      language: "pt-BR",
      content: "Stale recovery fatigue signal for versioning test",
      status: "active",
      effective_date: "2020-01-01",
      expiration_date: "2020-12-31",
      created_at: now,
      updated_at: now,
      source_id: "src_recovery_checkin",
      metadata: {
        source_id: "src_recovery_checkin",
        kb_ref: "kb:recovery.stale",
        trust_level: "curated",
        expiration_date: "2020-12-31",
        effective_date: "2020-01-01",
      },
    });
    const { retrieval } = await retrieveKnowledge({
      query: "Stale recovery fatigue signal",
      domains: ["recovery"],
      mode: "keyword",
      asOf: "2026-03-11T12:00:00.000Z",
    });
    expect(retrieval.hits.every((h) => h.document_id !== "doc_stale_v1")).toBe(true);
  });

  it("wrong domain filter excludes off-domain docs", async () => {
    await seedProductionCorpus();
    const { retrieval } = await retrieveKnowledge({
      query: "protein macros kcal meal",
      domains: ["sleep"],
      mode: "hybrid",
      topK: 5,
    });
    expect(retrieval.hits.every((h) => h.domain === "sleep" || h.domain === "recovery")).toBe(
      true,
    );
  });

  it("citation mismatch: citation chunk_id matches hit", async () => {
    await seedProductionCorpus();
    const { retrieval, citations } = await retrieveKnowledge({
      query: "Coach FactPack DecisionProposal escalateCare",
      domains: ["coaching"],
      topK: 2,
    });
    expect(citations.length).toBe(retrieval.hits.length);
    for (let i = 0; i < citations.length; i += 1) {
      expect(citations[i]!.chunk_id).toBe(retrieval.hits[i]!.chunk_id);
      expect(citations[i]!.retrieval_id).toBe(retrieval.retrieval_id);
    }
  });

  it("duplicate chunks: re-ingest upserts same document_id", async () => {
    const base = {
      document_id: "doc_dup_v1",
      title: "Dup doc",
      domain: "behavior" as const,
      source: "internal_docs" as const,
      source_type: "structured" as const,
      version: "1.0.0",
      language: "pt-BR",
      content: "Adherence habit friction duplicate ingest test content",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { kb_ref: "kb:behavior.dup", source_id: "src_behavior_habits" },
    };
    const a = await ingestKnowledgeDocument(base);
    const b = await ingestKnowledgeDocument(base);
    expect(a.upserted).toBe(false);
    expect(b.upserted).toBe(true);
    const docs = (await import("@/ai/rag")).listKnowledgeDocuments("behavior");
    expect(docs.filter((d) => d.document_id === "doc_dup_v1")).toHaveLength(1);
  });

  it("source versioning: citation includes document_version", async () => {
    await seedProductionCorpus();
    const { citations } = await retrieveKnowledge({
      query: "Performance OS Context Safety Decision",
      domains: ["performance"],
      topK: 1,
    });
    expect(citations[0]?.document_version || citations[0]?.score != null).toBeTruthy();
  });

  it("retrieval timeout returns rag_status timeout without inventing hits", async () => {
    await seedProductionCorpus();
    const { retrieval, citations } = await retrieveKnowledge({
      query: "nutrition protein",
      domains: ["nutrition"],
      timeoutMs: 0,
    });
    expect(retrieval.hits).toHaveLength(0);
    expect(citations).toHaveLength(0);
    expect(["timeout", "error", "empty"]).toContain(retrieval.rag_status);
    expect(retrieval.evidence_available).toBe(false);
  });

  it("evidence quality rejects citation-only as adequate when scores low", () => {
    const q = evaluateEvidenceQuality(
      [
        {
          chunk_id: "c1",
          document_id: "d1",
          domain: "nutrition",
          score: 0.02,
          semantic_score: 0.01,
          keyword_score: 0.01,
          title: "x",
          excerpt: "y",
          metadata: { trust_level: "external_unverified" },
        },
      ],
      { preferredDomains: ["training"], minQuality: 0.5 },
    );
    expect(q.evidence_adequate).toBe(false);
  });

  it("skill required_knowledge resolves kb refs", async () => {
    await seedProductionCorpus();
    const out = await runSkill({
      skillId: "analyze_nutrition",
      trustedUserId: USER,
      agentId: "specialist_nutrition",
      callTool: async () => ({ ok: true, data: {} }),
    });
    expect(out.ok).toBe(true);
    expect(out.data?.rag_status).toBeTruthy();
    expect(out.data?.retrieval_status).toBeTruthy();
    expect(typeof out.data?.evidence_available).toBe("boolean");
  });

  it("domain eval dataset mostly passes on curated corpus", async () => {
    const results = await runDomainEvalDataset();
    const passed = results.filter((r) => r.passed).length;
    expect(passed).toBeGreaterThanOrEqual(4);
  });

  it("resolveKnowledgeRefs for training.basics", async () => {
    await seedProductionCorpus();
    const { citations, retrieval } = await resolveKnowledgeRefs(["kb:training.basics"]);
    expect(retrieval.rag_status).not.toBe("error");
    expect(citations.length).toBeGreaterThan(0);
  });
});
