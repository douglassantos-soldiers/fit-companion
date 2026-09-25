/**
 * Skills Framework — unit tests (mocked tools, no DB).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSkillRegistry,
  clearSkillRunLog,
  listSkills,
  registerAllSkills,
  runSkill,
  SKILL_ERROR,
  toDecisionProposalFromSkill,
  type SkillCallTool,
} from "@/ai/skills";

const USER = "user-skill-aaaa";

const REQUIRED = [
  "analyze_training",
  "select_exercise",
  "substitute_exercise",
  "adjust_training_load",
  "progression",
  "regression",
  "analyze_nutrition",
  "adjust_macros",
  "meal_substitution",
  "analyze_sleep",
  "analyze_recovery",
  "analyze_fatigue",
  "analyze_adherence",
  "detect_friction",
  "habit_intervention",
  "analyze_performance",
  "explain_decision",
  "analyze_outcome",
  "generate_daily_context",
] as const;

const mockCallTool: SkillCallTool = async (toolId) => {
  switch (toolId) {
    case "get_training_history":
      return {
        ok: true,
        data: {
          sessions: [
            { id: "s1", date: "2026-03-11", title: "Squat Day", durationMin: 50 },
            { id: "s2", date: "2026-03-10", title: "Push", durationMin: 40 },
            { id: "s3", date: "2026-03-09", title: "Pull", durationMin: 45 },
          ],
        },
      };
    case "get_current_plan":
      return {
        ok: true,
        data: {
          plan: { date: "2026-03-11", workoutMode: "full" },
          decisions: { trainingMode: "full", trainingVolume: 1, sessionDuration: 55 },
        },
      };
    case "get_training_session":
      return {
        ok: true,
        data: { session: { id: "s1", date: "2026-03-11", title: "Squat Day", exerciseCount: 4 } },
      };
    case "get_recovery":
      return {
        ok: true,
        data: {
          recovery: {
            score: 48,
            level: "low",
            readiness: "low",
            fatigueSignal: true,
          },
        },
      };
    case "get_sleep":
      return {
        ok: true,
        data: { sleep: { hours: 5.5, source: "checkin", avg7d: 6.2 } },
      };
    case "get_wearable_data":
      return {
        ok: true,
        data: { wearable: { available: false, confidence: null, restingHr: null, hrv: null } },
      };
    case "get_nutrition":
      return {
        ok: true,
        data: {
          nutrition: { mealsLoggedToday: 1, proteinAdherence7d: 0.55, kcalTrend: 0 },
        },
      };
    case "get_user_goal":
      return { ok: true, data: { goal: "massa", goals: { primary: "massa" } } };
    case "get_user_profile":
      return {
        ok: true,
        data: { profile: { name: "QA", goal: "massa" }, identity: { userId: USER } },
      };
    case "get_recent_decisions":
      return {
        ok: true,
        data: {
          trainingMode: "deload",
          decisions: [
            {
              decisionId: "dec_1",
              why: { reason_codes: ["sleep_low"], reason_aliases: ["LOW_SLEEP"] },
              what: { actions: [], decision_value: "deload" },
              expectedOutcome: { kind: "REDUCE_FATIGUE" },
            },
          ],
        },
      };
    case "get_recent_outcomes":
      return {
        ok: true,
        data: { outcomes: [{ kind: "session_completed", value: true }] },
      };
    default:
      return { ok: false, error_code: "unauthorized_tool" };
  }
};

beforeEach(() => {
  clearSkillRunLog();
  clearSkillRegistry();
  registerAllSkills({ force: true });
});

describe("Skills Framework", () => {
  it("registers all 19 required skills", () => {
    expect(listSkills().length).toBe(19);
    const ids = new Set(listSkills().map((s) => s.id));
    for (const id of REQUIRED) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("anonymous access is denied", async () => {
    const res = await runSkill({
      skillId: "analyze_training",
      trustedUserId: null,
      callTool: mockCallTool,
    });
    expect(res.ok).toBe(false);
    expect(res.error_code).toBe(SKILL_ERROR.ANONYMOUS_DENIED);
  });

  it("unknown skill fails", async () => {
    const res = await runSkill({
      skillId: "not_a_skill",
      trustedUserId: USER,
      callTool: mockCallTool,
    });
    expect(res.ok).toBe(false);
    expect(res.error_code).toBe(SKILL_ERROR.UNKNOWN_SKILL);
  });

  it("invalid input fails for substitute_exercise", async () => {
    const res = await runSkill({
      skillId: "substitute_exercise",
      trustedUserId: USER,
      input: {},
      callTool: mockCallTool,
    });
    expect(res.ok).toBe(false);
    expect(res.error_code).toBe(SKILL_ERROR.INVALID_INPUT);
  });

  it.each([...REQUIRED])("skill %s returns SkillResult with evidence", async (skillId) => {
    const input =
      skillId === "substitute_exercise" ? { sessionId: "s1" } : ({ date: "2026-03-11" } as const);
    const res = await runSkill({
      skillId,
      trustedUserId: USER,
      input,
      callTool: mockCallTool,
    });
    expect(res.ok).toBe(true);
    expect(res.data).toBeDefined();
    expect(Array.isArray(res.data!.evidence)).toBe(true);
    expect(typeof res.data!.confidence).toBe("number");
    expect(Array.isArray(res.data!.warnings)).toBe(true);
    expect(res.skill_run.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("adjust_training_load emits SkillProposal without mutating", async () => {
    const res = await runSkill({
      skillId: "adjust_training_load",
      trustedUserId: USER,
      callTool: mockCallTool,
    });
    expect(res.ok).toBe(true);
    expect(res.data!.proposal).toBeTruthy();
    expect(res.data!.proposal!.proposed_type).toBe("REDUCE_VOLUME");
    const bridged = toDecisionProposalFromSkill(res.data!.proposal!);
    expect(bridged.source).toBe("agent");
    expect(bridged.proposed_type).toBe("REDUCE_VOLUME");
    expect(bridged.user_id).toBe(USER);
  });

  it("habit_intervention and progression emit proposals", async () => {
    const habit = await runSkill({
      skillId: "habit_intervention",
      trustedUserId: USER,
      callTool: mockCallTool,
    });
    expect(habit.data?.proposal?.proposed_type).toBe("CHECKIN");

    const prog = await runSkill({
      skillId: "progression",
      trustedUserId: USER,
      callTool: mockCallTool,
    });
    expect(prog.data?.proposal?.proposed_type).toBe("PROGRESSION");
  });

  it("explain_decision surfaces why/what/expected from tools", async () => {
    const res = await runSkill({
      skillId: "explain_decision",
      trustedUserId: USER,
      callTool: mockCallTool,
    });
    expect(res.ok).toBe(true);
    const result = res.data!.result as {
      why: unknown;
      what: unknown;
      expectedOutcome: unknown;
    };
    expect(result.why).toBeTruthy();
    expect(result.what).toBeTruthy();
    expect(result.expectedOutcome).toBeTruthy();
  });
});
