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
};
