/**
 * Skills Framework — core barrel.
 */
export { defineSkill } from "@/ai/skills/core/define-skill";
export { SKILL_ERROR, type SkillErrorCode } from "@/ai/skills/core/errors";
export {
  makeSkillProposal,
  buildSkillProposalId,
  toDecisionProposalFromSkill,
} from "@/ai/skills/core/proposal";
export {
  clearSkillRegistry,
  getSkill,
  hasSkill,
  listSkills,
  registerSkill,
} from "@/ai/skills/core/registry";
export { runSkill } from "@/ai/skills/core/run";
export { clearSkillRunLog, listSkillRuns, recordSkillRun } from "@/ai/skills/core/skill-run-log";
export { createToolBridge } from "@/ai/skills/core/tool-bridge";
export type {
  RegisteredSkill,
  SkillCallTool,
  SkillContext,
  SkillExecute,
  SkillInvokeRequest,
  SkillInvokeResult,
} from "@/ai/skills/core/types";
