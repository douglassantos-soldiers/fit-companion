/**
 * KnowledgeSource — registered external/product knowledge origin.
 * Adapters load documents; RAG never invents scientific claims.
 */

import type { KnowledgeDomain, KnowledgeSourceType } from "./knowledge-document";

/** @deprecated Prefer KnowledgeTrustLevel — kept for callers. */
export type KnowledgeTrustTier = "fixture" | "internal" | "curated" | "external_unverified";

export type KnowledgeTrustLevel = KnowledgeTrustTier;

export type KnowledgeSourceStatus = "active" | "deprecated" | "draft";

export type KnowledgeSource = {
  source_id: string;
  name: string;
  domain: KnowledgeDomain;
  /** Granular ingest format / origin kind. */
  type: KnowledgeSourceType;
  /** @deprecated use `type` — kept for FASE 4 callers */
  source_type?: KnowledgeSourceType;
  publisher: string;
  version: string;
  /** Canonical URL or internal reference path. */
  url?: string;
  reference?: string;
  license: string;
  status: KnowledgeSourceStatus;
  created_at: string;
  updated_at: string;
  /** Same semantics as trust_tier (FASE 16 name). */
  trust_level: KnowledgeTrustLevel;
  /** @deprecated Prefer trust_level */
  trust_tier?: KnowledgeTrustLevel;
  effective_date: string;
  expiration_date?: string | null;
  uri?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

/** Normalize legacy trust_tier → trust_level. */
export function resolveTrustLevel(source: Pick<KnowledgeSource, "trust_level" | "trust_tier">): KnowledgeTrustLevel {
  return source.trust_level ?? source.trust_tier ?? "internal";
}

export function resolveSourceType(source: Pick<KnowledgeSource, "type" | "source_type">): KnowledgeSourceType {
  return source.type ?? source.source_type ?? "unknown";
}
