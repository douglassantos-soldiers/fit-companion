/**
 * RAG / Knowledge Layer — Performance OS (FASE 16 production RAG).
 *
 * RAG = general/product knowledge (versioned, citable).
 * Memory = per-user history/context — see src/ai/memory (do not mix).
 * RAG never authorizes Decisions or Safety overrides.
 */

export type {
  KnowledgeChunk,
  KnowledgeCitation,
  KnowledgeDocument,
  KnowledgeDocumentSource,
  KnowledgeDomain,
  KnowledgeRetrieval,
  KnowledgeRetrievalHit,
  KnowledgeRetrievalMode,
  KnowledgeSource,
  KnowledgeSourceType,
  KnowledgeTrustTier,
  KnowledgeTrustLevel,
  RagRuntimeStatus,
} from "@/ai/contracts";
export { KNOWLEDGE_DOMAINS, expandDomainFilter } from "@/ai/contracts";

export {
  RAG_ERROR,
  RagError,
  clearKnowledgeStore,
  clearSourceRegistry,
  deleteKnowledgeDocument,
  getKnowledgeEntry,
  getSourceAdapter,
  getVectorStore,
  hasKnowledgeDocument,
  InMemoryVectorStore,
  knowledgeStoreSize,
  listKnowledgeDocuments,
  listKnowledgeSources,
  listSourceAdapters,
  registerSourceAdapter,
  resetVectorStore,
  resolveVectorStoreFromEnv,
  setVectorStore,
} from "@/ai/rag/core";
export type {
  IngestOptions,
  IngestResult,
  KnowledgeSourceAdapter,
  RetrieveKnowledgeOptions,
  RetrieveKnowledgeResult,
  VectorStore,
} from "@/ai/rag/core";

export { chunkDocument } from "@/ai/rag/chunking";
export {
  LocalLexicalEmbeddingProvider,
  LOCAL_LEXICAL_EMBEDDING_DIM,
  cosineSimilarity,
  generateEmbedding,
  generateEmbeddings,
  getEmbeddingProvider,
  resetEmbeddingProvider,
  setEmbeddingProvider,
  similarity,
} from "@/ai/rag/embeddings";
export type { EmbeddingProvider } from "@/ai/rag/embeddings";
export {
  ingestFromSource,
  ingestKnowledgeBatch,
  ingestKnowledgeDocument,
  seedProductionCorpus,
} from "@/ai/rag/ingestion";
export {
  getCitationsFromRetrieval,
  resolveKnowledgeRefs,
  retrieveKnowledge,
} from "@/ai/rag/retrieval";
export { rerankHits } from "@/ai/rag/reranking";
export { evaluateEvidenceQuality } from "@/ai/rag/evidence/quality";
export type { EvidenceQualityScores } from "@/ai/rag/evidence/quality";
export {
  createFixtureSourceAdapter,
  listConnectedSourceIds,
  registerAllKnowledgeSources,
} from "@/ai/rag/sources";
export {
  EVAL_FIXTURES,
  evalDuplicateDocuments,
  evalEmptyRetrieval,
  evalRetrievalRelevance,
  evalSourceQuality,
  evalWrongDomainRetrieval,
  runRagEvaluation,
  seedEvalFixtures,
} from "@/ai/rag/evaluation";
export type { EvalCaseResult } from "@/ai/rag/evaluation";
export { DOMAIN_EVAL_DATASET, runDomainEvalDataset } from "@/ai/rag/evaluation/dataset";
export type { DomainEvalQuestion } from "@/ai/rag/evaluation/dataset";
export { registerRagInfrastructure } from "@/ai/rag/register";

import { registerRagInfrastructure } from "@/ai/rag/register";

registerRagInfrastructure();
