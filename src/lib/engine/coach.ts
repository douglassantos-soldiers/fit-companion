import { CHALLENGES } from "@/data/challenges";
import { lessonForToday } from "@/data/habit-lessons";
import { PRODUCTS } from "@/data/products";
import {
  performanceDimensions,
  performanceScore,
  sessionsInLastDays,
  streak,
} from "@/lib/engine/dimensions";
import { computeLearningInsights, learningWeekHint } from "@/lib/engine/learning";
import { decisionContextForUi } from "@/lib/engine/assemble-decision-context";
import {
  buildDailyMealPlan,
  dayNutritionTotals,
  nextSuggestedMeal,
  nutritionGoals,
} from "@/lib/engine/nutrition";
import { buildWeeklyPlanDetailed, planDayForToday } from "@/lib/engine/plan";
import { WEEK_MODE_LABEL } from "@/lib/engine/progression";
import { dosesTakenToday, monthlyDoseAdherence } from "@/lib/engine/supplements";
import { GOAL_LABEL, MEAL_SLOT_LABEL, todayKey, type AppState } from "@/lib/types";

export interface CoachPrompt {
  id: string;
  label: string;
}

export const COACH_PROMPTS: CoachPrompt[] = [
  { id: "hoje", label: "Qual é o treino de hoje?" },
  { id: "por-que", label: "Por que meu plano mudou?" },
  { id: "por-que-treino", label: "Por que meu treino mudou?" },
  { id: "por-que-calorias", label: "Por que minhas calorias mudaram?" },
  { id: "por-que-descanso", label: "Por que você recomenda descanso?" },
  { id: "por-que-proteina", label: "Por que minha proteína mudou?" },
  { id: "plano", label: "Como está meu plano da semana?" },
  { id: "progresso", label: "Estou evoluindo?" },
  { id: "nutricao", label: "Como está minha nutrição?" },
  { id: "habito", label: "Lição de hoje" },
  { id: "suplemento", label: "O que tomar hoje?" },
  { id: "sem-tempo", label: "Só tenho 20 minutos" },
  { id: "dor", label: "Estou dolorido" },
  { id: "desafio", label: "Me sugere um desafio" },
];

function whyFromChange(state: AppState, key: string): string | null {
  const living = decisionContextForUi(state)?.livingPlan ?? state.livingPlans?.[todayKey()] ?? null;
  const hit = living?.whyByChange?.find((w) => w.key === key);
  return hit?.reason ?? null;
}

export function coachReply(promptId: string, state: AppState): string {
  const profile = state.profile;
  if (!profile) return "Complete seu perfil de performance para eu montar o próximo passo.";

  const insights = computeLearningInsights(state);
  const prefs = {
    likedExerciseIds: state.likedExerciseIds ?? [],
    dislikedExerciseIds: state.dislikedExerciseIds ?? [],
  };
  const { days: plan, weekMode } = buildWeeklyPlanDetailed(
    profile,
    state.sessions,
    undefined,
    learningWeekHint(state),
    prefs,
  );
  const today = planDayForToday(plan);
  const recent = sessionsInLastDays(state.sessions, 7);
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const st = streak(state.sessions);
  const goals = nutritionGoals(profile, insights);
  const totals = dayNutritionTotals(state.meals ?? []);
  const mealPlan = buildDailyMealPlan(profile, state, todayKey(), insights);
  const nextMeal = nextSuggestedMeal(mealPlan);
  const lesson = lessonForToday(new Date(), null, {
    goal: profile.goal,
    level: profile.level,
  });
  const routine = state.supplementRoutine.length
    ? state.supplementRoutine
    : PRODUCTS.filter((p) => p.goals.includes(profile.goal))
        .slice(0, 3)
        .map((p) => p.id);
  const dosesToday = dosesTakenToday(state.supplementLogs, routine);
  const monthAdh = monthlyDoseAdherence(state.supplementLogs, routine);
  const learnNote = insights?.reasons[0] ? ` Aprendizado: ${insights.reasons[0]}` : "";
  const built = decisionContextForUi(state);

  const modeNote =
    weekMode === "deload"
      ? ` Estamos em ${WEEK_MODE_LABEL.deload.toLowerCase()} por causa do RPE recente — volume reduzido de propósito.`
      : weekMode === "push"
        ? ` Estamos em ${WEEK_MODE_LABEL.push.toLowerCase()}: o motor aumentou o estímulo porque seus treinos recentes foram fáceis.`
        : "";

  switch (promptId) {
    case "hoje": {
      const living = built?.livingPlan ?? state.livingPlans?.[todayKey()] ?? null;
      if (living) {
        return `Hoje: ${living.workout.title} (${living.workout.mode}, ~${living.workout.estimatedMin} min, volume ${Math.round(living.workout.volumeFactor * 100)}%). Hábito: ${living.habits.title}. ${living.narrative}`;
      }
      return today
        ? `Hoje é ${today.title} — ${today.focus}. ${today.exercises.length} exercícios, cerca de ${today.estimatedMin} minutos.${modeNote} Abra a aba Treino e comece pelo primeiro movimento.`
        : `Hoje é dia de descanso ativo: 20 a 30 minutos de caminhada e mobilidade já bastam.${modeNote}`;
    }
    case "por-que": {
      const living = built?.livingPlan ?? state.livingPlans?.[todayKey()] ?? null;
      if (!living?.why.length)
        return `Ainda sem sinais fortes de adaptação.${modeNote}${learnNote}`;
      const byChange = living.whyByChange?.length
        ? ` Detalhes: ${living.whyByChange.map((w) => `${w.label}: ${w.reason}`).join(" ")}`
        : "";
      return `Por que o plano de hoje: ${living.why.slice(0, 4).join(" ")}${byChange}${
        living.diffFromYesterday.length
          ? ` Diff vs ontem: ${living.diffFromYesterday.join("; ")}.`
          : ""
      }`;
    }
    case "por-que-treino": {
      const reason =
        whyFromChange(state, "training") ??
        built?.decisions.decisions.find((d) => d.decisionType === "training_mode")?.explanation;
      return reason
        ? `Por que o treino mudou: ${reason}`
        : `O treino de hoje segue o plano padrão da semana.${modeNote}`;
    }
    case "por-que-calorias": {
      const reason =
        whyFromChange(state, "calories") ??
        built?.decisions.decisions.find((d) => d.decisionType === "nutrition_calorie_delta")
          ?.explanation;
      return reason
        ? `Por que as calorias mudaram: ${reason}`
        : "As calorias estão estáveis em relação à meta do perfil.";
    }
    case "por-que-descanso": {
      const reason =
        whyFromChange(state, "recovery") ??
        whyFromChange(state, "training") ??
        built?.decisions.decisions.find((d) => d.decisionType === "primary_action")?.explanation;
      return reason
        ? `Por que recomendo descanso: ${reason}`
        : "Hoje não há sinal forte de descanso — o treino segue liberado.";
    }
    case "por-que-proteina": {
      const reason =
        whyFromChange(state, "protein") ??
        built?.decisions.decisions.find((d) => d.decisionType === "nutrition_protein_bias")
          ?.explanation;
      return reason
        ? `Por que a proteína mudou: ${reason}`
        : "A meta de proteína segue o padrão do seu objetivo.";
    }
    case "plano":
      return `Seu plano tem ${plan.length} treinos por semana com foco em ${GOAL_LABEL[profile.goal].toLowerCase()}. Nos últimos 7 dias você fez ${recent.length} de ${profile.daysPerWeek}.${modeNote} ${
        recent.length >= profile.daysPerWeek
          ? "Semana cumprida, mantenha o ritmo."
          : "Encaixe os treinos que faltam nos próximos dias."
      }${learnNote}`;
    case "progresso": {
      const weakest = [...dims].sort((a, b) => a.score - b.score)[0]!;
      return `Seu score de performance está em ${score}/100. O ponto mais fraco agora é ${weakest.label.toLowerCase()} (${weakest.score}). Vou priorizar isso nas próximas semanas.${modeNote}${learnNote}`;
    }
    case "nutricao": {
      const suggest = nextMeal?.preset
        ? ` Próximo slot sugerido: ${MEAL_SLOT_LABEL[nextMeal.slot]} — ${nextMeal.preset.label} (${nextMeal.preset.proteinG} g).`
        : " Todos os slots do plano de hoje já estão registrados.";
      return `Hoje você está com ${totals.proteinG} g de ${goals.proteinG} g de proteína e ${totals.count} de ${goals.mealsTarget} refeições (meta ${goals.kcal} kcal).${
        totals.proteinG >= goals.proteinG * 0.8
          ? " Bom ritmo — mantenha proteína em cada refeição."
          : " Falta proteína: aplique o plano em Nutrição ou escolha um preset verde."
      }${suggest}${learnNote} Aderência de suplementos no mês: ${monthAdh.pct}%.`;
    }
    case "habito":
      return `Lição de hoje — ${lesson.title}: ${lesson.body} Dica prática: ${lesson.tip}${learnNote}`;
    case "suplemento": {
      const recommended = PRODUCTS.filter((p) => p.goals.includes(profile.goal)).slice(0, 3);
      return `Para o seu objetivo: ${recommended
        .map((p) => `${p.name} (${p.timing.toLowerCase()})`)
        .join(
          ", ",
        )}. Hoje ${dosesToday}/${routine.length || recommended.length} doses marcadas. Aderência do mês: ${monthAdh.pct}%.${learnNote}`;
    }
    case "sem-tempo":
      return today
        ? `Versão curta do ${today.title}: faça os 3 primeiros exercícios (${today.exercises
            .slice(0, 3)
            .map((e) => e.name)
            .join(", ")}) com descanso de 45 s. Treino curto conta para o seu streak.`
        : "Faça 15 minutos de circuito: agachamento, flexão e prancha em 4 voltas.";
    case "dor":
      return weekMode === "deload" || learningWeekHint(state) === "deload"
        ? `Faz sentido estar dolorido — o app já aponta deload. Reduza carga, priorize água e sono. Se a dor for articular, use Trocar no exercício e escolha uma variação sem dor.`
        : `Dor muscular normal com ${st} dia(s) de streak é sinal de estímulo. Reduza a carga em 10% hoje, aumente a água e priorize sono. Se a dor for articular, pule o movimento e troque por uma variação sem dor.`;
    case "desafio": {
      const open = CHALLENGES.filter((c) => !state.challenges.includes(c.id));
      const pick = open[0] ?? CHALLENGES[0]!;
      return `Entra no "${pick.title}": ${pick.description} Você já tem ${state.sessions.length} treino(s) registrados, então o ritmo ajuda.`;
    }
    default:
      return "Posso ajustar treino, nutrição, hábitos, suplementação e desafios. Escolha uma das opções abaixo.";
  }
}

export function coachFreeform(text: string, state: AppState) {
  const t = text.toLowerCase();
  if (
    (t.includes("por que") || t.includes("porque") || t.includes("porquê")) &&
    (t.includes("treino") || t.includes("volume") || t.includes("sessão") || t.includes("sessao"))
  )
    return coachReply("por-que-treino", state);
  if (
    (t.includes("por que") || t.includes("porque") || t.includes("porquê")) &&
    (t.includes("caloria") || t.includes("kcal") || t.includes("energia"))
  )
    return coachReply("por-que-calorias", state);
  if (
    (t.includes("por que") || t.includes("porque") || t.includes("porquê")) &&
    (t.includes("descans") || t.includes("recuper") || t.includes("sono"))
  )
    return coachReply("por-que-descanso", state);
  if (
    (t.includes("por que") || t.includes("porque") || t.includes("porquê")) &&
    (t.includes("proteína") || t.includes("proteina"))
  )
    return coachReply("por-que-proteina", state);
  if (
    (t.includes("por que") || t.includes("porque") || t.includes("porquê")) &&
    (t.includes("mudou") || t.includes("plano") || t.includes("why"))
  )
    return coachReply("por-que", state);
  if (t.includes("treino") && (t.includes("hoje") || t.includes("agora")))
    return coachReply("hoje", state);
  if (t.includes("suplement") || t.includes("whey") || t.includes("creatina"))
    return coachReply("suplemento", state);
  if (
    t.includes("proteína") ||
    t.includes("proteina") ||
    t.includes("comida") ||
    t.includes("refeição") ||
    t.includes("refeicao") ||
    t.includes("nutri") ||
    t.includes("plano alimentar")
  )
    return coachReply("nutricao", state);
  if (t.includes("hábito") || t.includes("habito") || t.includes("lição") || t.includes("licao"))
    return coachReply("habito", state);
  if (t.includes("dor") || t.includes("cansad")) return coachReply("dor", state);
  if (t.includes("desafio")) return coachReply("desafio", state);
  if (t.includes("peso") || t.includes("evolu") || t.includes("progress"))
    return coachReply("progresso", state);
  if (t.includes("tempo") || t.includes("minuto")) return coachReply("sem-tempo", state);
  if (t.includes("deload") || t.includes("push") || t.includes("semana"))
    return coachReply("plano", state);
  return coachReply("plano", state);
}
