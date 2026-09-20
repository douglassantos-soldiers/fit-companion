import { actionsFromIds } from "@/lib/coach/actions";
import { evidenceFromContext } from "@/lib/coach/evidence";
import { makeProposal } from "@/lib/coach/proposals";
import type { CoachContext, WorkflowResult } from "@/lib/coach/types";

export function nutritionReviewWorkflow(ctx: CoachContext): WorkflowResult {
  const evidence = evidenceFromContext(ctx);
  const analysis: string[] = [];
  const target = ctx.nutrition.proteinTarget;
  analysis.push(
    `Hoje: P ${ctx.nutrition.proteinG}g | C ${ctx.nutrition.carbG}g | G ${ctx.nutrition.fatG}g | ${ctx.nutrition.kcal} kcal`,
  );
  if (target != null) {
    const ratio = ctx.nutrition.proteinG / Math.max(1, target);
    analysis.push(`Proteína vs meta: ${Math.round(ratio * 100)}%`);
  }
  if (ctx.nutrition.loggingConfidence != null) {
    analysis.push(`Confiança de logging: ${ctx.nutrition.loggingConfidence}`);
  }
  if (ctx.customer360.nutritionAdherence != null) {
    analysis.push(`Aderência 7d (dias logados): ${ctx.customer360.nutritionAdherence}`);
  }

  const proteinGap =
    target != null && ctx.nutrition.proteinG < target * 0.85;

  const proposal = proteinGap
    ? makeProposal(
        "NUTRITION_FOCUS",
        true,
        ["protein_low"],
        evidence as Record<string, string | number | boolean | null>,
        0.75,
      )
    : makeProposal(
        "HYDRATION_FOCUS",
        true,
        [],
        evidence as Record<string, string | number | boolean | null>,
        0.55,
      );

  return {
    workflow: "nutrition-review",
    analysis,
    proposal,
    outcomeExpectation: "Usuário registra refeição ou ajusta macros do plano",
    evidence,
    actions: actionsFromIds(["recommend_meal", "open_nutrition", "recommend_hydration"]),
    risks: proteinGap ? ["Gap proteico no dia"] : [],
    nextFocus: proteinGap ? "Fechar meta de proteína" : "Manter logging completo",
    confidence: proposal.confidence,
  };
}
