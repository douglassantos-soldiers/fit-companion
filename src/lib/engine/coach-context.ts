import {
  performanceDimensions,
  performanceScore,
  adherenceScore,
  sessionsInLastDays,
  streak,
} from "@/lib/engine/dimensions";
import {
  computeLearningInsights,
  learningWeekHint,
  extractUserPatterns,
  patternInsights,
} from "@/lib/engine/learning";
import { buildUserContext } from "@/lib/engine/context";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import { buildDailyMealPlan, dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { buildWeeklyPlan, planDayForToday } from "@/lib/engine/plan";
import { evaluateSafetyForDate } from "@/lib/engine/safety";
import { activeHubForState } from "@/data/hubs";
import {
  BLOCKER_LABEL,
  GOAL_LABEL,
  LEVEL_LABEL,
  MEAL_SLOT_LABEL,
  todayKey,
  type AppState,
} from "@/lib/types";

export type CoachContextBundle = {
  contextText: string;
  safetyNotice?: string;
  why: string[];
  decisions: Array<{ type: string; value: string | number | boolean; explanation: string }>;
  livingSummary: string;
};

/** Build coach context from AppState (server-trusted when hydrated from DB). */
export function buildCoachContextFromState(
  state: AppState,
  opts?: { decisionSnapshot?: DecisionContextSnapshot | null },
): CoachContextBundle {
  const p = state.profile;
  if (!p) {
    return {
      contextText: "O usuário ainda não preencheu o perfil. Incentive-o a completar o perfil.",
      why: [],
      decisions: [],
      livingSummary: "indisponível",
    };
  }

  const insights = computeLearningInsights(state);
  const goals = nutritionGoals(p, insights);
  const plan = buildWeeklyPlan(p, state.sessions, learningWeekHint(state), {
    likedExerciseIds: state.likedExerciseIds ?? [],
    dislikedExerciseIds: state.dislikedExerciseIds ?? [],
  });
  const today = planDayForToday(plan);
  const mealPlan = buildDailyMealPlan(p, state, todayKey(), insights);
  const dims = performanceDimensions(state, p);
  const recent = sessionsInLastDays(state.sessions, 7);
  const metrics = state.days[todayKey()];
  const totals = dayNutritionTotals(state.meals ?? []);
  const date = todayKey();
  const decisionSnapshot =
    opts?.decisionSnapshot ??
    state.decisionContextByDate?.[date] ??
    assembleDecisionContext(state, { date, source: "offline_legacy" });
  const living = decisionSnapshot?.livingPlan ?? state.livingPlans?.[date] ?? null;
  const builtDecisions = decisionSnapshot?.decisions ?? null;
  const checkIn = state.dayCheckIns?.[date];
  const activeHub = activeHubForState(state.joinedHubIds);
  const ctx = buildUserContext(state, state.userId);
  const patterns = extractUserPatterns(state);
  const patternLines = patternInsights(patterns);
  const safety = decisionSnapshot?.safety ?? evaluateSafetyForDate(state, date);

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

  const why = living?.why?.length ? living.why : ctx.why;
  const whyBlock = why.length ? [`Por que o plano de hoje:`, ...why.map((r) => `- ${r}`)] : [];

  const whyByChangeBlock = living?.whyByChange?.length
    ? ["Why por mudança:", ...living.whyByChange.map((w) => `- ${w.label}: ${w.reason}`)]
    : [];

  const contextBlock = ctx.why.length
    ? [`Contexto de hoje (Context Engine):`, ...ctx.why.map((r) => `- ${r}`)]
    : ["Contexto de hoje: estável."];

  const reasonBlock = ctx.reasonCodes.length ? [`Reason codes: ${ctx.reasonCodes.join(", ")}`] : [];

  const decisions =
    builtDecisions?.decisions.map((d) => ({
      type: d.decisionType,
      value: d.decisionValue,
      explanation: d.explanation,
    })) ?? [];

  const decisionBlock = decisions.length
    ? [
        "Decisões de hoje (Decision Engine — NÃO recalcule volume/kcal/mode; apenas explique):",
        ...builtDecisions!.decisions.map(
          (d) =>
            `- ${d.decisionType}=${String(d.decisionValue)} | codes=[${d.reasonCodes.join(",")}] | conf=${d.confidence} | ${d.explanation}`,
        ),
      ]
    : [];

  const patternBlock = patternLines.length
    ? [`Padrões observados:`, ...patternLines.map((r) => `- ${r}`)]
    : [];

  const safetyBlock = [
    `Safety: escalate=${safety.escalateCare} | blockStims=${safety.blockStims} | light=${safety.preferLightTraining} | flags=${safety.flags.join(",")}`,
    ...safety.reasons.map((r) => `- ${r}`),
  ];

  const livingSummary = living
    ? `treino ${living.workout.mode} (${living.workout.title}, volume ${Math.round(living.workout.volumeFactor * 100)}%) | macros ${living.nutrition.proteinG}g / ${living.nutrition.kcal} kcal | sono meta ${living.sleepTargetHours}h | hábito ${living.habits.title} | freio ${living.blocker?.label ?? "—"}`
    : "indisponível";

  const contextText = [
    "Baseie-se nos dados abaixo. Nunca invente números. Não dê diagnóstico médico.",
    "Use os aprendizados e o plano alimentar sugerido quando falar de nutrição.",
    "Não assuma objetivo a partir de produtos comprados — objetivo vem do perfil.",
    "",
    `Nome: ${p.name}`,
    `Objetivo: ${GOAL_LABEL[p.goal]} | Nível: ${LEVEL_LABEL[p.level]} | Local: ${p.equipment}`,
    `Idade ${p.age} | Altura ${p.heightCm} cm | Peso ${p.weightKg} kg | ${p.daysPerWeek} treinos/semana`,
    p.restrictions.length
      ? `Restrições: ${p.restrictions.join(", ")}`
      : "Sem restrições registradas",
    p.primaryBlocker
      ? `Bloqueio declarado: ${BLOCKER_LABEL[p.primaryBlocker]}`
      : "Sem bloqueio declarado",
    `Sono típico: ${p.typicalSleepHours ?? "—"} h | Pula café: ${p.skipBreakfast ? "sim" : "não"}`,
    checkIn
      ? `Check-in hoje: sono ${checkIn.sleepHours}h | energia ${checkIn.energy} | ${checkIn.availableMin} min${checkIn.soreness != null ? ` | dor ${checkIn.soreness}` : ""}${checkIn.stress != null ? ` | stress ${checkIn.stress}` : ""}`
      : "Sem check-in de hoje",
    `Score de performance (sem suplementação): ${performanceScore(dims)}/100 | Aderência: ${adherenceScore(dims)}/100`,
    `Dimensões: ${dims.map((d) => `${d.label} ${d.score}`).join(", ")}`,
    `Living plan: ${livingSummary}`,
    `Streak: ${streak(state.sessions)} dia(s) | Treinos nos últimos 7 dias: ${recent.length}`,
    `Treinos registrados no total: ${state.sessions.length}`,
    today
      ? `Treino de hoje (semana): ${today.title} — ${today.focus} (${today.estimatedMin} min)`
      : "Hoje é descanso (sem treino agendado)",
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
    ...safetyBlock,
    ...contextBlock,
    ...reasonBlock,
    ...decisionBlock,
    ...learningBlock,
    ...patternBlock,
    ...whyBlock,
    ...whyByChangeBlock,
  ].join("\n");

  const safetyNotice = safety.escalateCare
    ? (safety.reasons.find((r) => r.includes("profissional") || r.includes("atenção")) ??
      "Há um sinal no check-in que merece atenção profissional — não trate como adaptação de treino.")
    : undefined;

  return {
    contextText,
    why,
    decisions,
    livingSummary,
    ...(safetyNotice ? { safetyNotice } : {}),
  };
}

/** Local/offline helper — same body as server context text. */
export function coachSystemPrompt(state: AppState): string {
  return buildCoachContextFromState(state).contextText;
}
