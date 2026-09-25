/**
 * Nutrition skills (deterministic).
 */
import { defineSkill } from "@/ai/skills/core/define-skill";
import { asRecord, dateInput, requireToolData, skillOk } from "@/ai/skills/core/helpers";
import { makeSkillProposal } from "@/ai/skills/core/proposal";

export function registerNutritionSkills(): void {
  defineSkill({
    id: "analyze_nutrition",
    name: "analyze_nutrition",
    description: "Analyze nutrition adherence signals",
    domain: "nutrition",
    required_tool_ids: ["get_nutrition"],
    required_knowledge: ["kb:nutrition.basics"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const nut = await requireToolData(ctx.callTool, "get_nutrition", di);
      if (!nut.ok) warnings.push(nut.warning);
      const n = asRecord(asRecord(nut.ok ? nut.data : {})["nutrition"]);
      const protein = n["proteinAdherence7d"];
      const low = typeof protein === "number" ? protein < 0.7 : n["mealsLoggedToday"] === 0;
      return skillOk(
        {
          mealsLoggedToday: n["mealsLoggedToday"] ?? null,
          proteinAdherence7d: protein ?? null,
          lowAdherence: low,
        },
        [
          {
            signal: "proteinAdherence7d",
            value: typeof protein === "number" ? protein : null,
            source: "get_nutrition",
          },
        ],
        0.75,
        warnings,
      );
    },
  });

  defineSkill({
    id: "adjust_macros",
    name: "adjust_macros",
    description: "Propose macro bias from nutrition + goal (no mutation)",
    domain: "nutrition",
    kind: "proposal",
    required_tool_ids: ["get_nutrition", "get_user_goal"],
    required_knowledge: ["kb:nutrition.macros"],
    safety_requirements: {
      requires_decision_authority: true,
      proposal_only_for_side_effects: true,
      requires_safety_gate: false,
    },
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const nut = await requireToolData(ctx.callTool, "get_nutrition", di);
      const goal = await requireToolData(ctx.callTool, "get_user_goal", di);
      if (!nut.ok) warnings.push(nut.warning);
      if (!goal.ok) warnings.push(goal.warning);
      const n = asRecord(asRecord(nut.ok ? nut.data : {})["nutrition"]);
      const g = asRecord(goal.ok ? goal.data : {});
      const protein = n["proteinAdherence7d"];
      const needUp = typeof protein === "number" ? protein < 0.75 : true;
      const proposal = needUp
        ? makeSkillProposal({
            skillId: ctx.skillId,
            userId: ctx.userId,
            proposedType: "NUTRITION_FOCUS",
            proposedValue: "protein_up",
            reasonCodes: ["protein_low"],
            confidence: 0.7,
          })
        : null;
      return skillOk(
        { goal: g["goal"] ?? null, proteinBias: needUp ? "up" : "hold" },
        [
          {
            signal: "proteinAdherence7d",
            value: typeof protein === "number" ? protein : null,
            source: "get_nutrition",
          },
        ],
        0.7,
        warnings,
        proposal,
      );
    },
  });

  defineSkill({
    id: "meal_substitution",
    name: "meal_substitution",
    description: "Suggest a meal substitution idea",
    domain: "nutrition",
    required_tool_ids: ["get_nutrition"],
    required_knowledge: ["kb:nutrition.meals"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const nut = await requireToolData(ctx.callTool, "get_nutrition", di);
      if (!nut.ok) warnings.push(nut.warning);
      const meals = asRecord(asRecord(nut.ok ? nut.data : {})["nutrition"])["mealsLoggedToday"];
      return skillOk(
        {
          suggestion: "swap_refined_carb_for_protein_veg",
          mealsLoggedToday: typeof meals === "number" ? meals : null,
        },
        [
          {
            signal: "mealsLoggedToday",
            value: typeof meals === "number" ? meals : null,
            source: "get_nutrition",
          },
        ],
        0.6,
        warnings,
      );
    },
  });
}
