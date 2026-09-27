/**
 * Domain evaluation dataset — expected sources/topics/quality thresholds.
 */

import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import { seedProductionCorpus } from "@/ai/rag/ingestion";
import { clearKnowledgeStore } from "@/ai/rag/core/store";
import { resetEmbeddingProvider } from "@/ai/rag/embeddings";
import { evaluateEvidenceQuality } from "@/ai/rag/evidence/quality";
import { retrieveKnowledge } from "@/ai/rag/retrieval";
import { registerAllKnowledgeSources } from "@/ai/rag/sources";

export type DomainEvalQuestion = {
  question_id: string;
  domain: KnowledgeDomain;
  query: string;
  expected_sources: string[];
  expected_topics: string[];
  minimum_relevance: number;
  minimum_evidence_quality: number;
};

export const DOMAIN_EVAL_DATASET: DomainEvalQuestion[] = [
  {
    question_id: "q_training_mode",
    domain: "training",
    query: "trainingMode full express deload rest Decision Engine volume",
    expected_sources: ["src_exercise_catalog_schema"],
    expected_topics: ["trainingMode", "load", "volume"],
    minimum_relevance: 0.05,
    minimum_evidence_quality: 0.2,
  },
  {
    question_id: "q_nutrition_macros",
    domain: "nutrition",
    query: "proteinG energyKcal meal macros nutrient snapshot",
    expected_sources: ["src_nutrition_labels"],
    expected_topics: ["protein", "macros"],
    minimum_relevance: 0.05,
    minimum_evidence_quality: 0.2,
  },
  {
    question_id: "q_recovery_fatigue",
    domain: "recovery",
    query: "recovery fatigue readiness energy soreness stress",
    expected_sources: ["src_recovery_checkin"],
    expected_topics: ["fatigue", "recovery"],
    minimum_relevance: 0.05,
    minimum_evidence_quality: 0.2,
  },
  {
    question_id: "q_sleep_hours",
    domain: "sleep",
    query: "sleepHours check-in typicalSleepHours sleep_low",
    expected_sources: ["src_sleep_checkin"],
    expected_topics: ["sleep"],
    minimum_relevance: 0.05,
    minimum_evidence_quality: 0.2,
  },
  {
    question_id: "q_behavior_adherence",
    domain: "behavior",
    query: "adherence friction habit lessons weekend pattern",
    expected_sources: ["src_behavior_habits"],
    expected_topics: ["adherence", "habits"],
    minimum_relevance: 0.05,
    minimum_evidence_quality: 0.2,
  },
  {
    question_id: "q_performance_pipeline",
    domain: "performance",
    query: "Context Safety Decision Engine Living Plan Proposal",
    expected_sources: ["src_performance_os"],
    expected_topics: ["Decision", "Living Plan"],
    minimum_relevance: 0.05,
    minimum_evidence_quality: 0.2,
  },
];

export async function runDomainEvalDataset(): Promise<
  Array<{ question_id: string; passed: boolean; detail: string }>
> {
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerAllKnowledgeSources({ force: true });
  await seedProductionCorpus();

  const results: Array<{ question_id: string; passed: boolean; detail: string }> = [];
  for (const q of DOMAIN_EVAL_DATASET) {
    const { retrieval } = await retrieveKnowledge({
      query: q.query,
      domains: [q.domain],
      mode: "hybrid",
      topK: 5,
    });
    const quality = evaluateEvidenceQuality(retrieval.hits, {
      preferredDomains: [q.domain],
      minQuality: q.minimum_evidence_quality,
    });
    const sourceHit = retrieval.hits.some(
      (h) => h.source_id && q.expected_sources.includes(h.source_id),
    );
    const topicHit = q.expected_topics.some((t) =>
      retrieval.hits.some(
        (h) =>
          h.content?.toLowerCase().includes(t.toLowerCase()) ||
          h.excerpt.toLowerCase().includes(t.toLowerCase()),
      ),
    );
    const passed =
      retrieval.hits.length > 0 &&
      quality.relevance >= q.minimum_relevance &&
      quality.evidence_quality >= q.minimum_evidence_quality &&
      sourceHit &&
      topicHit;
    results.push({
      question_id: q.question_id,
      passed,
      detail: `hits=${retrieval.hits.length} rel=${quality.relevance.toFixed(2)} eq=${quality.evidence_quality.toFixed(2)} source=${sourceHit} topic=${topicHit}`,
    });
  }
  return results;
}
