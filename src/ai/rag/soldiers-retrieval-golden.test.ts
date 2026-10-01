/**
 * Soldiers KB retrieval golden — neural embeddings, Portuguese queries, kb_ref hit.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { cosineSimilarity } from "@/ai/rag/embeddings";
import { MultilingualNeuralEmbeddingProvider } from "@/ai/rag/embeddings/neural";
import { SOLDIERS_RETRIEVAL_GOLDEN } from "@/ai/rag/evaluation/soldiers-golden";
import {
  clearKnowledgeStore,
  registerAllKnowledgeSources,
  resetEmbeddingProvider,
  resetVectorStore,
  retrieveKnowledge,
  seedProductionCorpus,
} from "@/ai/rag";

beforeEach(async () => {
  resetVectorStore();
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerAllKnowledgeSources({ force: true });
  await seedProductionCorpus();
});

describe("Soldiers retrieval golden", () => {
  it("aligns creatine paraphrase closer than an unrelated training phrase", () => {
    const provider = new MultilingualNeuralEmbeddingProvider();
    const q = provider.embed("monoidrato ajuda na forca");
    const creatine = provider.embed("creatina monoidratada aumenta forca e massa magra");
    const unrelated = provider.embed("progressao linear de carga no agachamento");
    expect(cosineSimilarity(q, creatine)).toBeGreaterThan(cosineSimilarity(q, unrelated));
    expect(provider.embed("probe")).toHaveLength(256);
  });

  it.each(SOLDIERS_RETRIEVAL_GOLDEN)(
    "$question_id hits $expected_kb_ref",
    async ({ query, expected_kb_ref }) => {
      const { retrieval } = await retrieveKnowledge({
        query,
        mode: "hybrid",
        topK: 5,
      });
      const refs = retrieval.hits.map((h) => h.metadata?.["kb_ref"]);
      expect(refs).toContain(expected_kb_ref);
      const cited = retrieval.citations?.find((c) => c.kb_ref === expected_kb_ref);
      expect(cited?.kb_ref).toBe(expected_kb_ref);
    },
  );
});
