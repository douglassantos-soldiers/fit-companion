/**
 * AgentAnalysisResult — Specialist Agent output.
 * Analysis / Evidence / Confidence / Proposal only — never a final Decision.
 */

import type { KnowledgeCitation } from "./knowledge-citation";
import type { DecisionProposal } from "./proposal";
import type { SkillEvidenceItem } from "./skill-result";

export type AgentAnalysisStatus = "completed" | "failed" | "blocked";

export type AgentAnalysisResult = {
  agent_id: string;
  run_id: string;
  user_id: string;
  analysis: unknown;
  evidence: SkillEvidenceItem[];
  confidence: number;
  proposal?: DecisionProposal | null;
  warnings: string[];
  citations?: KnowledgeCitation[];
  memory_ids?: string[];
  skill_run_ids?: string[];
  tool_call_ids?: string[];
  status: AgentAnalysisStatus;
  /** FASE 16 — explicit RAG failure (never invent evidence) */
  rag_status?: "ok" | "empty" | "error" | "timeout" | "skipped";
  retrieval_status?: "ok" | "empty" | "error" | "timeout" | "skipped";
  /** FASE 22.2 — agent-facing availability */
  rag_availability?: "RAG_AVAILABLE" | "RAG_DEGRADED" | "RAG_UNAVAILABLE";
  evidence_available?: boolean;
};
