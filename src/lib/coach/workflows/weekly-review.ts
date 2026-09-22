import { actionsFromIds } from "@/lib/coach/actions";
import { evidenceFromContext } from "@/lib/coach/evidence";
import { makeProposal } from "@/lib/coach/proposals";
import type { CoachContext, WorkflowResult } from "@/lib/coach/types";

export function weeklyReviewWorkflow(ctx: CoachContext): WorkflowResult {
  const evidence = evidenceFromContext(ctx);
  const wins: string[] = [];
  const risks: string[] = [];
  const analysis: string[] = [];

  analysis.push(`Treinos 7d: ${ctx.training.sessions7d} | streak ${ctx.training.streak}`);
  analysis.push(
    `Nutrição: P ${ctx.nutrition.proteinG}/${ctx.nutrition.proteinTarget ?? "?"} g | meals ${ctx.behavior.meals7d}`,
  );
  analysis.push(`Recovery: ${ctx.recovery.level ?? "—"} | hardRpeStreak ${ctx.recovery.hardRpeStreak}`);

  if (ctx.training.sessions7d >= 3) wins.push("Frequência de treino consistente na semana");
  if (ctx.exercisePerformance.recentPrs.length) {
    wins.push(`PRs recentes: ${ctx.exercisePerformance.recentPrs.map((p) => p.label).join("; ")}`);
  }
  if (
    ctx.nutrition.proteinTarget &&
    ctx.nutrition.proteinG >= ctx.nutrition.proteinTarget * 0.8
  ) {
    wins.push("Proteína do dia próxima da meta");
  }

  if (ctx.training.sessions7d < 2) risks.push("Poucos treinos nos últimos 7 dias");
  if (ctx.recovery.hardRpeStreak >= 3) risks.push("Streak alto de RPE difícil");
  if (ctx.customer360.nutritionAdherence != null && ctx.customer360.nutritionAdherence < 0.6) {
    risks.push("Aderência proteica baixa (dias logados)");
  }
  const kcalDecision = ctx.todayDecisions.find((d) => d.type === "nutrition_calorie_delta");
  if (kcalDecision) {
    const d = Number(kcalDecision.value);
    if (Number.isFinite(d) && d !== 0) {
      analysis.push(`Ajuste semanal de kcal: ${d > 0 ? "+" : ""}${d}`);
      wins.push(
        d > 0
          ? `Meta de calorias aumentada em ${d} kcal nesta semana`
          : `Meta de calorias reduzida em ${Math.abs(d)} kcal nesta semana`,
      );
    } else if (
      kcalDecision.reasonCodes.includes("incomplete_logging") ||
      kcalDecision.reasonCodes.includes("adherence_gate")
    ) {
      risks.push(kcalDecision.explanation);
    }
  }
  if (ctx.userPatterns.some((p) => /fim de semana|weekend/i.test(p))) {
    risks.push("Padrão de queda no fim de semana");
  }

  const nextFocus = risks[0]
    ? risks[0]
    : wins.length
      ? "Manter progressão e logging"
      : "Completar check-in e registrar refeições";

  const proposal = risks.some((r) => /RPE|recuper/i.test(r))
    ? makeProposal("INCREASE_RECOVERY", true, ["rpe_high"], evidence as Record<string, string | number | boolean | null>, 0.75)
    : risks.some((r) => /prote|nutri|refei/i.test(r))
      ? makeProposal("NUTRITION_FOCUS", true, ["protein_low"], evidence as Record<string, string | number | boolean | null>, 0.7)
      : makeProposal("FULL_WORKOUT", true, [], evidence as Record<string, string | number | boolean | null>, 0.65);

  const confidence =
    ctx.training.sessions7d >= 3 && ctx.behavior.meals7d >= 5
      ? 0.85
      : ctx.training.sessions7d >= 1
        ? 0.6
        : 0.35;

  return {
    workflow: "weekly-review",
    analysis,
    proposal,
    outcomeExpectation: "Usuário define foco da próxima semana",
    evidence,
    actions: actionsFromIds(["open_training", "open_nutrition", "start_checkin"]),
    wins: wins.length ? wins : ["Semana em construção — continue registrando"],
    risks: risks.length ? risks : ["Nenhum risco crítico detectado"],
    nextFocus,
    confidence,
  };
}

/** Public alias matching plan naming */
export function weeklyReview(ctx: CoachContext): WorkflowResult {
  return weeklyReviewWorkflow(ctx);
}
