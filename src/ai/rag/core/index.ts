/**
 * RAG core barrel.
 */

export { RAG_ERROR, RagError } from "@/ai/rag/core/errors";
export {
  clearSourceRegistry,
  getSourceAdapter,
  listKnowledgeSources,
  listSourceAdapters,
  registerSourceAdapter,
  requireSourceAdapter,
} from "@/ai/rag/core/registry";
export {
  clearKnowledgeStore,
  deleteKnowledgeDocument,
  getKnowledgeEntry,
  hasKnowledgeDocument,
  knowledgeStoreSize,
  listKnowledgeChunks,
  listKnowledgeDocuments,
  upsertKnowledgeEntry,
} from "@/ai/rag/core/store";
export {
  getVectorStore,
  resetVectorStore,
  resolveVectorStoreFromEnv,
  setVectorStore,
} from "@/ai/rag/core/vector-store";
export type { VectorStore, VectorQueryOpts, StoredVectorHit } from "@/ai/rag/core/vector-store";
export { InMemoryVectorStore } from "@/ai/rag/core/vector-store-memory";
export type {
  IngestOptions,
  IngestResult,
  KnowledgeSourceAdapter,
  RetrieveKnowledgeOptions,
  RetrieveKnowledgeResult,
  StoredKnowledgeEntry,
} from "@/ai/rag/core/types";
