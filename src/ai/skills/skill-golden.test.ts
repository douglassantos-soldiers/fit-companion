/**
 * Golden cases for skill thresholds: load, substitution, supplement without prescription.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSkillRegistry,
  clearSkillRunLog,
  registerAllSkills,
  runSkill,
  type SkillCallTool,
} from "@/ai/skills";

const USER = "user-skill-golden";

function tool(data: Record<string, unknown>): SkillCallTool {
  return async (toolId) => {
    if (toolId === "get_recovery") return { ok: true, data };
    if (toolId === "get_current_plan") {
      return { ok: true, data: { plan: { workoutMode: "full" }, decisions: { trainingMode: "full" } } };
    }
    if (toolId === "get_training_session") {
      return { ok: true, data: { session: { id: "s1", title: "Squat Day" } } };
    }
    if (toolId === "search_knowledge") return { ok: true, data: { hits: [] } };
    return { ok: false, error_code: "unauthorized_tool" };
  };
}

beforeEach(() => {
  clearSkillRunLog();
  clearSkillRegistry();
  registerAllSkills({ force: true });
});

describe("skill golden thresholds", () => {
  it("reduces load only when recovery is low or fatigued", async () => {
    const low = await runSkill({
      skillId: "adjust_training_load",
      trustedUserId: USER,
      callTool: tool({ recovery: { level: "low", fatigueSignal: true } }),
    });
    expect(low.ok).toBe(true);
    expect(low.data?.proposal?.proposed_type).toBe("REDUCE_VOLUME");
    expect(low.data?.proposal?.confidence).toBeGreaterThanOrEqual(0.7);
    expect(low.data?.evidence.some((e) => e.signal === "fatigueSignal")).toBe(true);

    const ok = await runSkill({
      skillId: "adjust_training_load",
      trustedUserId: USER,
      callTool: tool({ recovery: { level: "high", fatigueSignal: false } }),
    });
    expect(ok.data?.proposal).toBeUndefined();
    expect(ok.data?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("substitution stays a heuristic suggestion without a decision proposal", async () => {
    const res = await runSkill({
      skillId: "substitute_exercise",
      trustedUserId: USER,
      input: { sessionId: "s1", exerciseHint: "agachamento" },
      callTool: tool({}),
    });
    expect(res.ok).toBe(true);
    expect(res.data?.proposal).toBeUndefined();
    const result = res.data?.result as { substitute?: string };
    expect(result.substitute).toBe("agachamento_alt");
    expect(res.data?.confidence).toBe(0.55);
  });

  it("supplement explanation does not prescribe when retrieval is empty", async () => {
    const res = await runSkill({
      skillId: "explain_supplement",
      trustedUserId: USER,
      input: { query: "creatina" },
      callTool: tool({}),
    });
    expect(res.ok).toBe(true);
    expect(res.data?.proposal).toBeUndefined();
    const result = res.data?.result as { summary?: string; commercial?: boolean };
    expect(result.commercial).toBe(false);
    expect(result.summary ?? "").toMatch(/Não invento|Sem trechos/i);
    expect(result.summary ?? "").not.toMatch(/você deve tomar/i);
  });
});
