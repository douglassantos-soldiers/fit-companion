import { performanceDimensions, performanceScore, sessionsInLastDays, streak } from "@/lib/engine/dimensions";
import { computeLearningInsights, learningWeekHint } from "@/lib/engine/learning";
import { buildDailyMealPlan, dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { buildWeeklyPlan, planDayForToday } from "@/lib/engine/plan";
import { GOAL_LABEL, LEVEL_LABEL, MEAL_SLOT_LABEL, todayKey, type AppState } from "@/lib/types";

/** Resumo dos dados do usuário enviado ao modelo como contexto. */
export function coachSystemPrompt(state: AppState): string {
  const p = state.profile;
  if (!p) {
    return "Você é o coach de performance do app Soldiers. O usuário ainda não preencheu o perfil. Responda em português do Brasil, de forma curta e direta, e incentive-o a completar o perfil.";
  }

  const insights = computeLearningInsights(state);
  const goals = nutritionGoals(p, insights);
  const plan = buildWeeklyPlan(p, state.sessions, learningWeekHint(state));
  const today = planDayForToday(plan);
  const mealPlan = buildDailyMealPlan(p, state, todayKey(), insights);
  const dims = performanceDimensions(state, p);
  const recent = sessionsInLastDays(state.sessions, 7);
  const metrics = state.days[todayKey()];
  const totals = dayNutritionTotals(state.meals ?? []);

  const mealLines = mealPlan.slots
    .map((s) => {
      if (s.status === "logged") {
        return `${MEAL_SLOT_LABEL[s.slot]}: registrado (${s.logged.map((m) => m.label).join(", ")})`;
      }
      return `${MEAL_SLOT_LABEL[s.slot]}: sugerido ${s.preset?.label ?? "—"}`;
    })
    .join("; ");

  const learningBlock =
    insights && insights.reasons.length
      ? [`Aprendizados recentes:`, ...insights.reasons.map((r) => `- ${r}`)]
      : ["Aprendizados recentes: nenhum ajuste automático no momento."];

  return [
    "Você é o coach de performance do app Soldiers (treino, nutrição e suplementação).",
    "Responda sempre em português do Brasil, em tom direto e motivador, no máximo 6 frases.",
    "Baseie-se nos dados abaixo. Nunca invente números. Não dê diagnóstico médico.",
    "Use os aprendizados e o plano alimentar sugerido quando falar de nutrição.",
    "",
    `Nome: ${p.name}`,
    `Objetivo: ${GOAL_LABEL[p.goal]} | Nível: ${LEVEL_LABEL[p.level]} | Local: ${p.equipment}`,
    `Idade ${p.age} | Altura ${p.heightCm} cm | Peso ${p.weightKg} kg | ${p.daysPerWeek} treinos/semana`,
    p.restrictions.length ? `Restrições: ${p.restrictions.join(", ")}` : "Sem restrições registradas",
    `Score de performance: ${performanceScore(dims)}/100 (${dims.map((d) => `${d.label} ${d.score}`).join(", ")})`,
    `Streak: ${streak(state.sessions)} dia(s) | Treinos nos últimos 7 dias: ${recent.length}`,
    `Treinos registrados no total: ${state.sessions.length}`,
    today ? `Treino de hoje: ${today.title} — ${today.focus} (${today.estimatedMin} min)` : "Hoje é descanso ativo",
    `Metas nutricionais (ajustadas): ${goals.proteinG} g proteína | ${goals.kcal} kcal | água ${goals.waterMl} ml`,
    `Nutrição hoje: ${totals.proteinG} g proteína | ${totals.kcal} kcal | ${totals.count} refeições`,
    `Plano alimentar de hoje: ${mealLines}`,
    `Hidratação hoje: ${metrics?.waterMl ?? 0} ml`,
    `Suplementos da rotina: ${state.supplementRoutine.length ? state.supplementRoutine.join(", ") : "nenhum"}`,
    state.purchaseProductIds?.length
      ? `Produtos comprados na Soldiers: ${state.purchaseProductIds.join(", ")}`
      : "Sem snapshot de compra Soldiers",
    `Tier de acesso: ${state.accessTier ?? "base"}`,
    `Desafios ativos: ${state.challenges.length ? state.challenges.join(", ") : "nenhum"}`,
    "",
    ...learningBlock,
  ].join("\n");
}
