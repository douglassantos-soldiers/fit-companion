/**
 * Helper to define and register a Skill.
 */
import type { SkillDomain, SkillKind, SkillSafetyRequirements } from "@/ai/contracts/skill";
import { registerSkill } from "@/ai/skills/core/registry";
import type { JsonSchemaLike } from "@/ai/mcp/core/types";
import type { RegisteredSkill, SkillExecute } from "@/ai/skills/core/types";

const DEFAULT_SAFETY: SkillSafetyRequirements = {
  requires_safety_gate: false,
  requires_decision_authority: false,
  proposal_only_for_side_effects: true,
};

export function defineSkill(opts: {
  id: string;
  name: string;
  description: string;
  domain: SkillDomain;
  kind?: SkillKind;
  required_tool_ids: string[];
  required_knowledge?: string[];
  safety_requirements?: Partial<SkillSafetyRequirements>;
  input_schema?: JsonSchemaLike;
  output_schema?: JsonSchemaLike;
  version?: string;
  execute: SkillExecute;
}): RegisteredSkill {
  const skill: RegisteredSkill = {
    id: opts.id,
    name: opts.name,
    version: opts.version ?? "1",
    domain: opts.domain,
    kind: opts.kind ?? "analysis",
    description: opts.description,
    required_tool_ids: opts.required_tool_ids,
    required_knowledge: opts.required_knowledge ?? [],
    safety_requirements: { ...DEFAULT_SAFETY, ...opts.safety_requirements },
    input_schema: opts.input_schema ?? {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string" } },
    },
    output_schema: opts.output_schema ?? {
      type: "object",
      required: ["result", "evidence", "confidence", "warnings"],
    },
    execute: opts.execute,
  };
  registerSkill(skill);
  return skill;
}
