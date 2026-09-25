/**
 * Memory Layer — Performance OS.
 *
 * Memory = per-user history/context (4 families).
 * RAG = general/product knowledge — see src/ai/rag (do not mix).
 * Writes only via validated API — LLMs cannot write Memory directly.
 */

export type {
  DecisionMemory,
  DecisionMemoryType,
  LearningMemory,
  LearningMemoryType,
  MemoryData,
  MemoryFamily,
  MemoryRecord,
  MemorySource,
  MemoryStatus,
  OutcomeMemory,
  OutcomeMemoryType,
  UserMemory,
  UserMemoryKind,
  UserMemoryRecord,
  UserMemoryType,
} from "@/ai/contracts";
export { userMemoryToRecord } from "@/ai/contracts";

export {
  MEMORY_ERROR,
  MemoryError,
  LOW_CONFIDENCE_THRESHOLD,
  newMemoryId,
  requireTrustedMemoryUser,
  validateMemoryWrite,
} from "@/ai/memory/core";
export type {
  CreateMemoryInput,
  InvalidateMemoryInput,
  MemoryRetrieveResult,
  MemoryWriteResult,
  RetrieveMemoryInput,
  UpdateMemoryInput,
} from "@/ai/memory/core";

export {
  InMemoryMemoryStore,
  SupabaseMemoryStore,
  clearMemoryStoreRegistration,
  getMemoryStore,
  setMemoryStore,
} from "@/ai/memory/store";
export type {
  MemoryStore,
  MemoryStoreListFilter,
  SupabaseMemoryStoreOpts,
} from "@/ai/memory/store";

export { createMemory, invalidateMemory, retrieveMemory, updateMemory } from "@/ai/memory/api";

export { registerMemoryInfrastructure, resetMemoryInfrastructure } from "@/ai/memory/register";

import { registerMemoryInfrastructure } from "@/ai/memory/register";

registerMemoryInfrastructure();
