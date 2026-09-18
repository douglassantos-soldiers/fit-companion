/**
 * Learning guardrails — never promote clinical/dangerous inferences (FASE 5).
 */
import type { RecoveryLevel } from "@/lib/engine/recovery-v2";

const ALLOWED = [
  "weekday_skip",
  "avoids_long_workouts",
  "weekend_protein_drop",
  "sunday_meal_gap",
  "prefers_short_sessions",
  "poor_sleep_after_late_train",
  "volume_reduction_helps",
] as const;

export type AllowedPatternKind = (typeof ALLOWED)[number];

export const ALLOWED_PATTERN_KINDS: readonly AllowedPatternKind[] = ALLOWED;

const CLINICAL_RE =
  /\b(les[aã]o|fracture|diagn[oó]stico|m[eé]dico|dor aguda|infarto|desmaio|emergency|cl[ií]nico)\b/i;

export function isAllowedPatternKind(kind: string): kind is AllowedPatternKind {
  return (ALLOWED as readonly string[]).includes(kind);
}

export function evidenceLooksClinical(note: string): boolean {
  return CLINICAL_RE.test(note);
}

/**
 * Learning must never override Safety.
 * Returns false if a suggested bias would be dangerous given recovery/safety.
 */
export function learningBiasAllowed(opts: {
  recoveryLevel: RecoveryLevel;
  blockStims: boolean;
  preferLightTraining: boolean;
  suggestedVolumeIncrease: boolean;
}): boolean {
  if (opts.suggestedVolumeIncrease && opts.recoveryLevel === "low") return false;
  if (opts.suggestedVolumeIncrease && opts.preferLightTraining) return false;
  if (opts.blockStims && opts.suggestedVolumeIncrease) return false;
  return true;
}

export function sanitizeEvidenceNote(note: string): string {
  return note.slice(0, 160);
}
