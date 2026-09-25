/**
 * Behavior skills (deterministic).
 */
import { defineSkill } from "@/ai/skills/core/define-skill";
import { asRecord, dateInput, requireToolData, skillOk } from "@/ai/skills/core/helpers";
import { makeSkillProposal } from "@/ai/skills/core/proposal";

export function registerBehaviorSkills(): void {
  defineSkill({
    id: "analyze_adherence",
    name: "analyze_adherence",
    description: "Combine nutrition + training adherence signals",
    domain: "behavior",
    required_tool_ids: ["get_nutrition", "get_training_history"],
    required_knowledge: ["kb:behavior.adherence"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const nut = await requireToolData(ctx.callTool, "get_nutrition", di);
      const hist = await requireToolData(ctx.callTool, "get_training_history", { ...di, limit: 7 });
      if (!nut.ok) warnings.push(nut.warning);
      if (!hist.ok) warnings.push(hist.warning);
      const meals = asRecord(asRecord(nut.ok ? nut.data : {})["nutrition"])["mealsLoggedToday"];
      const sessions = (asRecord(hist.ok ? hist.data : {})["sessions"] as unknown[]) ?? [];
      const low = (typeof meals === "number" && meals === 0) || sessions.length < 2;
      return skillOk(
        {
          lowAdherence: low,
          mealsLoggedToday: typeof meals === "number" ? meals : null,
          sessionsRecent: sessions.length,
        },
        [
          {
            signal: "sessionsRecent",
            value: sessions.length,
            source: "get_training_history",
          },
        ],
        0.7,
        warnings,
      );
    },
  });

  defineSkill({
    id: "detect_friction",
    name: "detect_friction",
    description: "Detect training friction from outcomes + history",
    domain: "behavior",
    required_tool_ids: ["get_recent_outcomes", "get_training_history"],
    required_knowledge: ["kb:behavior.friction"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const outcomes = await requireToolData(ctx.callTool, "get_recent_outcomes", di);
      const hist = await requireToolData(ctx.callTool, "get_training_history", { ...di, limit: 5 });
      if (!outcomes.ok) warnings.push(outcomes.warning);
      if (!hist.ok) warnings.push(hist.warning);
      const list = (asRecord(outcomes.ok ? outcomes.data : {})["outcomes"] as unknown[]) ?? [];
      const sessions = (asRecord(hist.ok ? hist.data : {})["sessions"] as unknown[]) ?? [];
      const friction = list.length === 0 && sessions.length === 0;
      if (friction) warnings.push("no_recent_activity");
      return skillOk(
        { friction, outcomeCount: list.length, sessionCount: sessions.length },
        [{ signal: "friction", value: friction, source: "derived" }],
        0.65,
        warnings,
      );
    },
  });

  defineSkill({
    id: "habit_intervention",
    name: "habit_intervention",
    description: "Propose check-in / habit intervention (no mutation)",
    domain: "behavior",
    kind: "proposal",
    required_tool_ids: ["get_recent_decisions"],
    required_knowledge: ["kb:behavior.habits"],
    safety_requirements: {
      requires_decision_authority: true,
      proposal_only_for_side_effects: true,
      requires_safety_gate: false,
    },
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const decisions = await requireToolData(ctx.callTool, "get_recent_decisions", di);
      if (!decisions.ok) warnings.push(decisions.warning);
      const list = (asRecord(decisions.ok ? decisions.data : {})["decisions"] as unknown[]) ?? [];
      const proposal = makeSkillProposal({
        skillId: ctx.skillId,
        userId: ctx.userId,
        proposedType: "CHECKIN",
        proposedValue: true,
        reasonCodes: ["incomplete_logging"],
        confidence: 0.6,
        note: "prompt_daily_checkin",
      });
      return skillOk(
        { decisionCount: list.length, intervention: "checkin" },
        [{ signal: "decisionCount", value: list.length, source: "get_recent_decisions" }],
        0.6,
        warnings,
        proposal,
      );
    },
  });
}
