/**
 * Skill contract — reusable, versioned capabilities invoked by agents.
 * Skills must not write directly to the database; critical writes go through
 * SkillProposal → Decision Engine after Safety gates.
 * execute() lives on RegisteredSkill in the runtime, not on this pure contract.
 */

export type SkillKind =
  | "context_assembly"
  | "explanation"
  | "proposal"
  | "retrieval"
  | "evaluation"
  | "workflow"
  | "analysis"
  | "generic";

export type SkillDomain =
  "training" | "nutrition" | "recovery" | "behavior" | "performance" | "generic";

export type SkillSafetyRequirements = {
  requires_safety_gate: boolean;
  requires_decision_authority: boolean;
  /** If true, skill may only emit SkillProposal — never mutate. */
  proposal_only_for_side_effects: boolean;
};

export type Skill = {
  id: string;
  name: string;
  version: string;
  domain: SkillDomain;
  kind: SkillKind;
  description?: string;
  /** Tool ids this skill may request (never direct DB). */
  required_tool_ids: string[];
  /** Knowledge document refs (RAG later) — e.g. kb:training.basics */
  required_knowledge: string[];
  safety_requirements: SkillSafetyRequirements;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  input_schema_ref?: string;
  output_schema_ref?: string;
};
