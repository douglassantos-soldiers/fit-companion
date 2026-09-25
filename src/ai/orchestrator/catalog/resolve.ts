/**
 * Intersect agent allowlists with global skill/tool catalogs.
 */

import type { Agent } from "@/ai/contracts/agent";
import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import { getSkill, listSkills } from "@/ai/skills/core/registry";
import { getTool, listTools } from "@/ai/mcp/core/registry";
import { registerAllSkills } from "@/ai/skills/register";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { getAgent } from "@/ai/orchestrator/agents/registry";

export function ensureCatalogsBootstrapped(): void {
  registerAllSkills();
  registerAllMcpTools();
}

export function resolveSkillsForAgents(
  agentIds: string[],
  hints: string[],
): { skills: string[]; rejected: string[] } {
  ensureCatalogsBootstrapped();
  const allowed = new Set<string>();
  for (const id of agentIds) {
    const agent = getAgent(id);
    if (!agent) continue;
    for (const s of agent.allowed_skill_ids) allowed.add(s);
  }
  const global = new Set(listSkills().map((s) => s.id));
  const skills: string[] = [];
  const rejected: string[] = [];
  const candidates = hints.length ? hints : [...allowed];
  for (const s of candidates) {
    if (!global.has(s) || !getSkill(s)) {
      rejected.push(s);
      continue;
    }
    if (!allowed.has(s)) {
      rejected.push(s);
      continue;
    }
    if (!skills.includes(s)) skills.push(s);
  }
  return { skills, rejected };
}

export function resolveToolsForAgents(
  agentIds: string[],
  hints: string[],
): { tools: string[]; rejected: string[] } {
  ensureCatalogsBootstrapped();
  const allowed = new Set<string>();
  for (const id of agentIds) {
    const agent = getAgent(id);
    if (!agent) continue;
    for (const t of agent.allowed_tool_ids) allowed.add(t);
  }
  const global = new Set(listTools().map((t) => t.id));
  const tools: string[] = [];
  const rejected: string[] = [];
  const candidates = hints.length ? hints : [...allowed].slice(0, 6);
  for (const t of candidates) {
    if (!global.has(t) || !getTool(t)) {
      rejected.push(t);
      continue;
    }
    if (!allowed.has(t)) {
      rejected.push(t);
      continue;
    }
    if (!tools.includes(t)) tools.push(t);
  }
  return { tools, rejected };
}

export function agentOwnsSkill(agent: Agent, skillId: string): boolean {
  return agent.allowed_skill_ids.includes(skillId);
}

export function agentOwnsTool(agent: Agent, toolId: string): boolean {
  return agent.allowed_tool_ids.includes(toolId);
}

export function filterKnowledgeDomains(domains: KnowledgeDomain[]): KnowledgeDomain[] {
  return [...new Set(domains)];
}
