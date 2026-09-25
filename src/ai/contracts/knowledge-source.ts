/**
 * KnowledgeSource — registered external/product knowledge origin.
 * Adapters load documents; RAG never invents scientific claims.
 */

import type { KnowledgeDomain, KnowledgeSourceType } from "./knowledge-document";

export type KnowledgeTrustTier = "fixture" | "internal" | "curated" | "external_unverified";

export type KnowledgeSource = {
  source_id: string;
  name: string;
  source_type: KnowledgeSourceType;
  domain?: KnowledgeDomain;
  uri?: string;
  version?: string;
  trust_tier: KnowledgeTrustTier;
  metadata?: Record<string, string | number | boolean | null>;
};
