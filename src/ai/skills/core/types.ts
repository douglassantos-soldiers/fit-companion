/**
 * Skills Framework — runtime types.
 */
import type { Skill, SkillDomain, SkillKind, SkillSafetyRequirements } from "@/ai/contracts/skill";
import type { SkillResult } from "@/ai/contracts/skill-result";
import type { SkillRun } from "@/ai/contracts/skill-run";
import type { TrustedUserId } from "@/ai/contracts/trusted-user-id";
import type { JsonSchemaLike } from "@/ai/mcp/core/types";
import type { DomainContextLoader } from "@/ai/mcp/core/types";

export type SkillCallTool = (
  toolId: string,
  input?: Record<string, unknown>,
) => Promise<{ ok: boolean; data?: unknown; error_code?: string }>;

export type SkillContext = {
  userId: TrustedUserId;
  date: string;
  callTool: SkillCallTool;
  skillId: string;
};

export type SkillExecute = (
  ctx: SkillContext,
  input: Record<string, unknown>,
) => Promise<SkillResult>;

export type RegisteredSkill = Skill & {
  domain: SkillDomain;
  kind: SkillKind;
  required_tool_ids: string[];
  required_knowledge: string[];
  safety_requirements: SkillSafetyRequirements;
  input_schema: JsonSchemaLike;
  output_schema: JsonSchemaLike;
  execute: SkillExecute;
};

export type SkillInvokeRequest = {
  skillId: string;
  trustedUserId: string | null;
  input?: unknown;
  date?: string;
  agentId?: string;
  runId?: string;
  /** MCP domain loader (passed through to invokeTool). */
  loader?: DomainContextLoader;
  /** Test DI: override tool bridge. */
  callTool?: SkillCallTool;
};

export type SkillInvokeResult = {
  ok: boolean;
  status: SkillRun["status"];
  data?: SkillResult;
  error_code?: string;
  error_message?: string;
  skill_run: SkillRun;
};
