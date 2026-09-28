/**
 * FASE 22.9 — Canonical AI schema inventory (expected).
 * Never assume local migration files == applied remotely.
 */

export const AI_REQUIRED_MIGRATIONS = [
  {
    file: "20261018120000_fase9_ai_memory.sql",
    objects: [
      "ai_user_memory",
      "ai_decision_memory",
      "ai_outcome_memory",
      "ai_learning_events",
    ],
  },
  {
    file: "20261025120000_fase11_ai_audit_events.sql",
    objects: ["ai_audit_events"],
  },
  {
    file: "20261027120000_fase16_ai_knowledge.sql",
    objects: [
      "extension:vector",
      "ai_knowledge_sources",
      "ai_knowledge_documents",
      "ai_knowledge_chunks",
    ],
  },
  {
    file: "20261028120000_fase19_ai_audit_kinds.sql",
    objects: ["constraint:ai_audit_events_kind_check"],
  },
  {
    file: "20261029120000_fase22_3_memory_version.sql",
    objects: [
      "column:ai_user_memory.version",
      "column:ai_decision_memory.version",
      "column:ai_outcome_memory.version",
      "column:ai_learning_events.version",
    ],
  },
  {
    file: "20261030120000_fase22_6_ai_audit_durability.sql",
    objects: [
      "index:ai_audit_events_decision_id_idx",
      "index:ai_audit_events_parent_run_idx",
    ],
  },
  {
    file: "20261031120000_fase22_9_ai_schema_verify.sql",
    objects: ["function:ai_schema_inventory_probe"],
  },
] as const;

/** Critical AI tables (production). */
export const AI_REQUIRED_TABLES = [
  "ai_audit_events",
  "ai_user_memory",
  "ai_decision_memory",
  "ai_outcome_memory",
  "ai_learning_events",
  "ai_knowledge_sources",
  "ai_knowledge_documents",
  "ai_knowledge_chunks",
] as const;

export type AiRequiredTable = (typeof AI_REQUIRED_TABLES)[number];

/** Critical indexes that must exist remotely. */
export const AI_REQUIRED_INDEXES = [
  "ai_audit_events_user_created_idx",
  "ai_audit_events_run_idx",
  "ai_audit_events_kind_created_idx",
  "ai_audit_events_decision_id_idx",
  "ai_audit_events_parent_run_idx",
  "ai_user_memory_active_key_uidx",
  "ai_user_memory_user_idx",
  "ai_decision_memory_active_key_uidx",
  "ai_decision_memory_user_idx",
  "ai_outcome_memory_active_key_uidx",
  "ai_outcome_memory_user_idx",
  "ai_learning_events_active_key_uidx",
  "ai_learning_events_user_idx",
  "ai_knowledge_documents_domain_idx",
  "ai_knowledge_documents_source_idx",
  "ai_knowledge_chunks_document_idx",
  "ai_knowledge_chunks_source_idx",
] as const;

/** Columns required for drift detection. */
export const AI_REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "ai_user_memory", column: "version" },
  { table: "ai_decision_memory", column: "version" },
  { table: "ai_outcome_memory", column: "version" },
  { table: "ai_learning_events", column: "version" },
  { table: "ai_knowledge_chunks", column: "embedding" },
];

export const AI_REQUIRED_EXTENSIONS = ["vector"] as const;

/** Domain-adjacent (observed only — do not block AI PASS). */
export const AI_ADJACENT_TABLES = [
  "recommendation_decisions",
  "decision_context_snapshots",
  "decision_actions",
] as const;

export const AI_RLS_EXPECTATION = {
  row_security: true,
  /** No policies for anon/authenticated — service_role only. */
  authenticated_policies: 0,
  anon_policies: 0,
} as const;
