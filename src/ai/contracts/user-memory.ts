/**
 * UserMemory — per-user history/context facts (not general knowledge).
 * Aligns conceptually with coach_memories / CoachMemoryEntry.
 * Prefer MemoryRecord (family=user) for new AI Memory Layer writes.
 * Memory informs context; it is not Decision authority.
 */

export type UserMemoryKind =
  | "facts"
  | "preferences"
  | "patterns"
  | "recent_decisions"
  | "coach_notes"
  | "goals"
  | "constraints";

export type UserMemory = {
  memory_id: string;
  user_id: string;
  kind: UserMemoryKind;
  key: string;
  value: string | number | boolean | Record<string, unknown>;
  confidence: number;
  created_at: string;
  updated_at: string;
  source?: "coach" | "system" | "user" | "learning";
  expires_at?: string;
};
