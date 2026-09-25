/**
 * Skills Framework — registry.
 */
import type { SkillDomain } from "@/ai/contracts/skill";
import type { RegisteredSkill } from "@/ai/skills/core/types";

const byId = new Map<string, RegisteredSkill>();

export function registerSkill(skill: RegisteredSkill): void {
  if (!skill.id?.trim()) throw new Error("skill_missing_id");
  byId.set(skill.id, skill);
}

export function getSkill(skillId: string): RegisteredSkill | undefined {
  return byId.get(skillId);
}

export function listSkills(domain?: SkillDomain): RegisteredSkill[] {
  const all = [...byId.values()];
  if (!domain) return all;
  return all.filter((s) => s.domain === domain);
}

export function clearSkillRegistry(): void {
  byId.clear();
}

export function hasSkill(skillId: string): boolean {
  return byId.has(skillId);
}
