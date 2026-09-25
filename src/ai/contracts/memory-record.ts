/**
 * MemoryRecord — base AI Memory unit (per-user history/context).
 * Distinct from RAG (general/product knowledge). Not Decision authority.
 */

export type MemoryFamily = "user" | "decision" | "outcome" | "learning";

export type MemoryStatus = "active" | "invalidated" | "expired";

/** Allowed write sources — LLM / agent_raw rejected at validation. */
export type MemorySource = "system" | "coach" | "user" | "learning" | "decision_engine";

export type MemoryData = Record<string, string | number | boolean | null | string[]>;

export type MemoryRecord = {
  memory_id: string;
  user_id: string;
  family: MemoryFamily;
  type: string;
  data: MemoryData;
  source: MemorySource;
  confidence: number;
  status: MemoryStatus;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  key?: string;
  /** Soft flag when confidence < LOW_CONFIDENCE_THRESHOLD at write time */
  low_confidence?: boolean;
};
