/**
 * Outcome — AI-layer result of a Decision → Action cycle.
 * Distinct from client OutcomeKind helpers in src/lib/outcome.ts.
 * Feeds Learning; does not itself change authoritative product state.
 */

export type OutcomeQuality = "success" | "fail" | "mixed" | "unknown" | "pending";

export type OutcomeWindow = "d0" | "d1" | "d3" | "d7" | "custom";

export type Outcome = {
  outcome_id: string;
  user_id: string;
  decision_id: string;
  created_at: string;
  observed_at?: string;
  window: OutcomeWindow;
  quality: OutcomeQuality;
  metrics: Record<string, number | string | boolean | null>;
  notes?: string[];
  /** Agent/run that observed or reported this outcome, if any. */
  run_id?: string;
  attribution_type?: "direct" | "indirect" | "weak" | "unknown";
};
