/**
 * SkillResult / SkillProposal — outputs of Skills Framework.
 * Critical state changes = SkillProposal only (bridge to DecisionProposal).
 */

export type SkillEvidenceItem = {
  signal: string;
  value: string | number | boolean | null;
  source?: string;
};

export type SkillProposal = {
  proposal_id: string;
  skill_id: string;
  user_id: string;
  context_id?: string;
  proposed_type: string;
  proposed_value: string | number | boolean;
  reason_codes: string[];
  confidence: number;
  created_at: string;
  note?: string;
};

export type SkillResult = {
  result: unknown;
  evidence: SkillEvidenceItem[];
  confidence: number;
  warnings: string[];
  proposal?: SkillProposal | null;
  /** FASE 16 — RAG status when skill declared required_knowledge */
  rag_status?: "ok" | "empty" | "error" | "timeout" | "skipped";
  retrieval_status?: "ok" | "empty" | "error" | "timeout" | "skipped";
  /** FASE 22.2 */
  rag_availability?: "RAG_AVAILABLE" | "RAG_DEGRADED" | "RAG_UNAVAILABLE";
  evidence_available?: boolean;
  citations?: Array<{
    citation_id: string;
    document_id: string;
    chunk_id: string;
    title: string;
    score: number;
    excerpt: string;
    source_id?: string;
    retrieval_id?: string;
  }>;
};
