/**
 * Shared helpers for deterministic skills.
 */
import type { SkillEvidenceItem, SkillResult } from "@/ai/contracts/skill-result";
import type { SkillCallTool, SkillContext } from "@/ai/skills/core/types";

export async function requireToolData(
  callTool: SkillCallTool,
  toolId: string,
  input: Record<string, unknown> = {},
): Promise<{ ok: true; data: unknown } | { ok: false; warning: string }> {
  const res = await callTool(toolId, input);
  if (!res.ok) {
    return { ok: false, warning: `tool_failed:${toolId}:${res.error_code ?? "unknown"}` };
  }
  return { ok: true, data: res.data };
}

export function skillOk(
  result: unknown,
  evidence: SkillEvidenceItem[],
  confidence: number,
  warnings: string[] = [],
  proposal?: SkillResult["proposal"],
): SkillResult {
  const out: SkillResult = {
    result,
    evidence,
    confidence: Math.max(0, Math.min(1, confidence)),
    warnings,
  };
  if (proposal) out.proposal = proposal;
  return out;
}

export function asRecord(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

export function dateInput(
  ctx: SkillContext,
  input: Record<string, unknown>,
): Record<string, unknown> {
  return { date: typeof input["date"] === "string" ? input["date"] : ctx.date };
}
