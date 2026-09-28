/**
 * FASE 22.1 — AI path classification labels.
 * Use in JSDoc / metadata so production vs test vs legacy is never silent.
 */

export const AI_PATH_LABEL = {
  CANONICAL: "CANONICAL",
  CANONICAL_FACADE: "CANONICAL_FACADE",
  CANONICAL_WRAPPER: "CANONICAL_WRAPPER",
  TEST_ONLY: "TEST_ONLY",
  LEGACY: "LEGACY",
  DEPRECATED: "DEPRECATED",
} as const;

export type AiPathLabel = (typeof AI_PATH_LABEL)[keyof typeof AI_PATH_LABEL];

/** Stable metadata key for audit / agent_run.metadata.path_label */
export const AI_PATH_LABEL_META_KEY = "path_label" as const;
