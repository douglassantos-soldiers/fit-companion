/**
 * Memory Layer — request/result types.
 */

import type {
  MemoryData,
  MemoryFamily,
  MemoryRecord,
  MemorySource,
} from "@/ai/contracts/memory-record";

export const LOW_CONFIDENCE_THRESHOLD = 0.4;

export type CreateMemoryInput = {
  trustedUserId: string | null;
  family: MemoryFamily;
  type: string;
  data: MemoryData;
  source: MemorySource | string;
  confidence: number;
  key?: string;
  expiresAt?: string;
  /** When true, replace conflicting active key instead of error */
  supersede?: boolean;
};

export type RetrieveMemoryInput = {
  trustedUserId: string | null;
  family?: MemoryFamily;
  type?: string;
  key?: string;
  minConfidence?: number;
  includeExpired?: boolean;
  includeInvalidated?: boolean;
  limit?: number;
};

export type UpdateMemoryInput = {
  trustedUserId: string | null;
  memoryId: string;
  patch: {
    data?: MemoryData;
    confidence?: number;
    source?: MemorySource | string;
    expiresAt?: string | null;
    type?: string;
    key?: string;
  };
};

export type InvalidateMemoryInput = {
  trustedUserId: string | null;
  memoryId: string;
  reason?: string;
};

export type MemoryWriteResult = {
  ok: true;
  record: MemoryRecord;
  warnings: string[];
};

export type MemoryRetrieveResult = {
  ok: true;
  records: MemoryRecord[];
};

export type ValidatedMemoryWrite = {
  family: MemoryFamily;
  type: string;
  data: MemoryData;
  source: MemorySource;
  confidence: number;
  key?: string;
  expiresAt?: string;
  low_confidence: boolean;
  warnings: string[];
};
