/**
 * Memory Layer — Performance OS.
 *
 * Memory = per-user history/context (4 families).
 * RAG = general/product knowledge — see src/ai/rag (do not mix).
 * Writes only via validated API — LLMs cannot write Memory directly.
 * FASE 22.3 — production uses SupabaseMemoryStore via ensureMemoryStore (no silent InMemory).
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
  createSupabaseMemoryStore,
  ensureMemoryStore,
  getActiveMemoryStore,
  getMemoryStore,
  resetMemoryStoreRegistration,
  setMemoryStore,
} from "@/ai/memory/store";
export type {
  MemoryStore,
  MemoryStoreListFilter,
  SupabaseMemoryStoreOpts,
} from "@/ai/memory/store";

export { createMemory, invalidateMemory, retrieveMemory, updateMemory } from "@/ai/memory/api";

export {
  checkMemoryHealth,
  checkMemoryPersistence,
  getMemoryReadiness,
} from "@/ai/memory/health";
export type {
  MemoryHealthCheckId,
  MemoryHealthCheckResult,
  MemoryHealthReport,
  MemoryPersistenceReport,
  MemoryReadinessResult,
} from "@/ai/memory/health";

export {
  isMemoryProduction,
  resolveMemoryEnvironment,
  resolveMemoryStoreMode,
} from "@/ai/memory/runtime";
export type { MemoryEnvironment, MemoryStoreMode } from "@/ai/memory/runtime";

export { registerMemoryInfrastructure, resetMemoryInfrastructure } from "@/ai/memory/register";

import { registerMemoryInfrastructure } from "@/ai/memory/register";

registerMemoryInfrastructure();
