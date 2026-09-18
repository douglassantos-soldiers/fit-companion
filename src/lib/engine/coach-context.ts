import { performanceDimensions, performanceScore, adherenceScore, sessionsInLastDays, streak } from "@/lib/engine/dimensions";
import { computeLearningInsights, learningWeekHint, extractUserPatterns, patternInsights } from "@/lib/engine/learning";
import { buildUserContext } from "@/lib/engine/context";
import { buildLivingPlan } from "@/lib/engine/living-plan";
import { buildDailyMealPlan, dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { buildWeeklyPlan, planDayForToday } from "@/lib/engine/plan";
import { activeHubForState } from "@/data/hubs";
import { BLOCKER_LABEL, GOAL_LABEL, LEVEL_LABEL, MEAL_SLOT_LABEL, todayKey, type AppState } from "@/lib/types";

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
  const living = state.livingPlans?.[todayKey()] ?? buildLivingPlan(state);
  const checkIn = state.dayCheckIns?.[todayKey()];
  const activeHub = activeHubForState(state.joinedHubIds);
  const ctx = buildUserContext(state, state.userId);
  const patterns = extractUserPatterns(state);
  const patternLines = patternInsights(patterns);

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

  const whyBlock = living?.why?.length
    ? [`Por que o plano de hoje:`, ...living.why.map((r) => `- ${r}`)]
    : [];

  const contextBlock = ctx.why.length
    ? [`Contexto de hoje (Context Engine):`, ...ctx.why.map((r) => `- ${r}`)]
    : ["Contexto de hoje: estável."];

  const patternBlock = patternLines.length
    ? [`Padrões observados:`, ...patternLines.map((r) => `- ${r}`)]
    : [];

  return [
    "Você é o coach de performance do app Soldiers (treino, nutrição e suplementação).",
    "Responda sempre em português do Brasil, em tom direto e motivador, no máximo 6 frases.",
    "Baseie-se nos dados abaixo. Nunca invente números. Não dê diagnóstico médico.",
    "Quando perguntarem por que o plano mudou, use os blocos de contexto e 'Por que o plano de hoje'.",
    "Use os aprendizados e o plano alimentar sugerido quando falar de nutrição.",
    "Não assuma objetivo a partir de produtos comprados — objetivo vem do perfil.",
    "",
    `Nome: ${p.name}`,
    `Objetivo: ${GOAL_LABEL[p.goal]} | Nível: ${LEVEL_LABEL[p.level]} | Local: ${p.equipment}`,
    `Idade ${p.age} | Altura ${p.heightCm} cm | Peso ${p.weightKg} kg | ${p.daysPerWeek} treinos/semana`,
    p.restrictions.length ? `Restrições: ${p.restrictions.join(", ")}` : "Sem restrições registradas",
    p.primaryBlocker ? `Bloqueio declarado: ${BLOCKER_LABEL[p.primaryBlocker]}` : "Sem bloqueio declarado",
    `Sono típico: ${p.typicalSleepHours ?? "—"} h | Pula café: ${p.skipBreakfast ? "sim" : "não"}`,
    checkIn
      ? `Check-in hoje: sono ${checkIn.sleepHours}h | energia ${checkIn.energy} | ${checkIn.availableMin} min`
      : "Sem check-in de hoje",
    `Score de performance (sem suplementação): ${performanceScore(dims)}/100 | Aderência: ${adherenceScore(dims)}/100`,
    `Dimensões: ${dims.map((d) => `${d.label} ${d.score}`).join(", ")}`,
    living
      ? `Living plan: treino ${living.workout.mode} (${living.workout.title}, volume ${Math.round(living.workout.volumeFactor * 100)}%) | macros ${living.nutrition.proteinG}g / ${living.nutrition.kcal} kcal | sono meta ${living.sleepTargetHours}h | freio ${living.blocker?.label ?? "—"}`
      : "Living plan: indisponível",
    `Streak: ${streak(state.sessions)} dia(s) | Treinos nos últimos 7 dias: ${recent.length}`,
    `Treinos registrados no total: ${state.sessions.length}`,
    today ? `Treino de hoje (semana): ${today.title} — ${today.focus} (${today.estimatedMin} min)` : "Hoje é descanso (sem treino agendado)",
    `Metas nutricionais (ajustadas): ${goals.proteinG} g proteína | ${goals.kcal} kcal | água ${goals.waterMl} ml`,
    `Nutrição hoje: ${totals.proteinG} g proteína | ${totals.kcal} kcal | ${totals.count} refeições`,
    `Plano alimentar de hoje: ${mealLines}`,
    `Hidratação hoje: ${metrics?.waterMl ?? 0} ml`,
    `Suplementos da rotina: ${state.supplementRoutine.length ? state.supplementRoutine.join(", ") : "nenhum"}`,
    state.purchaseProductIds?.length
      ? `Produtos comprados (sinal commerce, NÃO objetivo): ${state.purchaseProductIds.join(", ")}`
      : "Sem snapshot de compra Soldiers",
    `Tier de acesso: ${state.accessTier ?? "base"}`,
    `Desafios ativos: ${state.challenges.length ? state.challenges.join(", ") : "nenhum"}`,
    activeHub
      ? `Hub ativo: ${activeHub.name} (${activeHub.creatorName}) — challenges: ${activeHub.challengeIds.join(", ")}`
      : "Sem hub ativo",
    "",
    ...contextBlock,
    ...learningBlock,
    ...patternBlock,
    ...whyBlock,
  ].join("\n");
}
