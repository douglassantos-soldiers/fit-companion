/**
 * RAG / Knowledge Layer — Performance OS.
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
} from "@/ai/contracts";
export { KNOWLEDGE_DOMAINS } from "@/ai/contracts";

export {
  RAG_ERROR,
  RagError,
  clearKnowledgeStore,
  clearSourceRegistry,
  deleteKnowledgeDocument,
  getKnowledgeEntry,
  getSourceAdapter,
  hasKnowledgeDocument,
  knowledgeStoreSize,
  listKnowledgeDocuments,
  listKnowledgeSources,
  listSourceAdapters,
  registerSourceAdapter,
} from "@/ai/rag/core";
export type {
  IngestOptions,
  IngestResult,
  KnowledgeSourceAdapter,
  RetrieveKnowledgeOptions,
  RetrieveKnowledgeResult,
} from "@/ai/rag/core";

export { chunkDocument } from "@/ai/rag/chunking";
export {
  LocalLexicalEmbeddingProvider,
  cosineSimilarity,
  getEmbeddingProvider,
  resetEmbeddingProvider,
  setEmbeddingProvider,
} from "@/ai/rag/embeddings";
export type { EmbeddingProvider } from "@/ai/rag/embeddings";
export {
  ingestFromSource,
  ingestKnowledgeBatch,
  ingestKnowledgeDocument,
} from "@/ai/rag/ingestion";
export {
  getCitationsFromRetrieval,
  resolveKnowledgeRefs,
  retrieveKnowledge,
} from "@/ai/rag/retrieval";
export { rerankHits } from "@/ai/rag/reranking";
export { createFixtureSourceAdapter, registerAllKnowledgeSources } from "@/ai/rag/sources";
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
export { registerRagInfrastructure } from "@/ai/rag/register";

import { registerRagInfrastructure } from "@/ai/rag/register";

registerRagInfrastructure();
