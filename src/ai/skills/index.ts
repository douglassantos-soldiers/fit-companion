/**
 * Skills Framework — Performance OS.
 * Agent = orchestration (future). Skill = specialized capability via Tools only.
 */

export type { Skill, SkillDomain, SkillKind, SkillSafetyRequirements } from "@/ai/contracts/skill";
export type { SkillRun, SkillRunStatus } from "@/ai/contracts/skill-run";
export type { SkillEvidenceItem, SkillProposal, SkillResult } from "@/ai/contracts/skill-result";

export {
  SKILL_ERROR,
  buildSkillProposalId,
  clearSkillRegistry,
  clearSkillRunLog,
  createToolBridge,
  defineSkill,
  getSkill,
  hasSkill,
  listSkillRuns,
  listSkills,
  makeSkillProposal,
  registerSkill,
  runSkill,
  toDecisionProposalFromSkill,
} from "@/ai/skills/core";
export type {
  RegisteredSkill,
  SkillCallTool,
  SkillContext,
  SkillInvokeRequest,
  SkillInvokeResult,
} from "@/ai/skills/core";
export { registerAllSkills } from "@/ai/skills/register";

import { registerAllSkills } from "@/ai/skills/register";

registerAllSkills();
