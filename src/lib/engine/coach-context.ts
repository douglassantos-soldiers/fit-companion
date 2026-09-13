import { performanceDimensions, performanceScore, sessionsInLastDays, streak } from "@/lib/engine/dimensions";
import { buildWeeklyPlan, planDayForToday } from "@/lib/engine/plan";
import { GOAL_LABEL, LEVEL_LABEL, todayKey, type AppState } from "@/lib/types";

/** Resumo dos dados do usuário enviado ao modelo como contexto. */
export function coachSystemPrompt(state: AppState): string {
  const p = state.profile;
  if (!p) {
    return "Você é o coach de performance do app Soldiers. O usuário ainda não preencheu o perfil. Responda em português do Brasil, de forma curta e direta, e incentive-o a completar o perfil.";
  }

  const plan = buildWeeklyPlan(p, state.sessions);
  const today = planDayForToday(plan);
  const dims = performanceDimensions(state, p);
  const recent = sessionsInLastDays(state.sessions, 7);
  const metrics = state.days[todayKey()];

  return [
    "Você é o coach de performance do app Soldiers (treino, nutrição e suplementação).",
    "Responda sempre em português do Brasil, em tom direto e motivador, no máximo 6 frases.",
    "Baseie-se nos dados abaixo. Nunca invente números. Não dê diagnóstico médico.",
    "",
    `Nome: ${p.name}`,
    `Objetivo: ${GOAL_LABEL[p.goal]} | Nível: ${LEVEL_LABEL[p.level]} | Local: ${p.equipment}`,
    `Idade ${p.age} | Altura ${p.heightCm} cm | Peso ${p.weightKg} kg | ${p.daysPerWeek} treinos/semana`,
    p.restrictions.length ? `Restrições: ${p.restrictions.join(", ")}` : "Sem restrições registradas",
    `Score de performance: ${performanceScore(dims)}/100 (${dims.map((d) => `${d.label} ${d.score}`).join(", ")})`,
    `Streak: ${streak(state.sessions)} dia(s) | Treinos nos últimos 7 dias: ${recent.length}`,
    `Treinos registrados no total: ${state.sessions.length}`,
    today ? `Treino de hoje: ${today.title} — ${today.focus} (${today.estimatedMin} min)` : "Hoje é descanso ativo",
    `Hidratação hoje: ${metrics?.waterMl ?? 0} ml | Refeições: ${metrics?.meals ?? 0}`,
    `Suplementos da rotina: ${state.supplementRoutine.length ? state.supplementRoutine.join(", ") : "nenhum"}`,
    `Desafios ativos: ${state.challenges.length ? state.challenges.join(", ") : "nenhum"}`,
  ].join("\n");
}
