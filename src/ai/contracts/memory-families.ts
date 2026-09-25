/**
 * User / Decision / Outcome / Learning memory specializations.
 */

import type { MemoryData, MemoryRecord, MemorySource } from "./memory-record";
import type { UserMemoryKind } from "./user-memory";

export type UserMemoryType = UserMemoryKind;

export type DecisionMemoryType =
  "decision_snapshot" | "reason_codes" | "mode_history" | "proposal_trace";

export type OutcomeMemoryType =
  "outcome_observed" | "outcome_window" | "attribution" | "quality_signal";

export type LearningMemoryType =
  | "pattern_detected"
  | "pattern_reinforced"
  | "pattern_weakened"
  | "intervention_response"
  | "experiment_settled"
  | "attribution_recorded"
  | "bias_blocked";

export type DecisionMemory = MemoryRecord & {
  family: "decision";
  type: DecisionMemoryType;
};

export type OutcomeMemory = MemoryRecord & {
  family: "outcome";
  type: OutcomeMemoryType;
};

export type LearningMemory = MemoryRecord & {
  family: "learning";
  type: LearningMemoryType;
};

export type UserMemoryRecord = MemoryRecord & {
  family: "user";
  type: UserMemoryType;
};

/** Map legacy UserMemory shape → MemoryRecord (family=user). */
export function userMemoryToRecord(input: {
  memory_id: string;
  user_id: string;
  kind: UserMemoryKind;
  key: string;
  value: string | number | boolean | Record<string, unknown>;
  confidence: number;
  created_at: string;
  updated_at: string;
  source?: MemorySource | "coach" | "system" | "user" | "learning";
  expires_at?: string;
}): UserMemoryRecord {
  const data: MemoryData =
    typeof input.value === "object" && input.value !== null && !Array.isArray(input.value)
      ? Object.fromEntries(
          Object.entries(input.value).map(([k, v]) => [
            k,
            (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null
              ? v
              : String(v)) as string | number | boolean | null,
          ]),
        )
      : { value: input.value as string | number | boolean };

  const source: MemorySource =
    input.source === "decision_engine" ? "decision_engine" : (input.source ?? "system");

  const out: UserMemoryRecord = {
    memory_id: input.memory_id,
    user_id: input.user_id,
    family: "user",
    type: input.kind,
    data,
    source,
    confidence: input.confidence,
    status: "active",
    created_at: input.created_at,
    updated_at: input.updated_at,
    key: input.key,
  };
  if (input.expires_at) out.expires_at = input.expires_at;
  return out;
}
