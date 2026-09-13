import { CHALLENGES } from "@/data/challenges";
import { PRODUCTS } from "@/data/products";
import { performanceDimensions, performanceScore, sessionsInLastDays, streak } from "@/lib/engine/dimensions";
import { buildWeeklyPlan, planDayForToday } from "@/lib/engine/plan";
import { GOAL_LABEL, type AppState } from "@/lib/types";

export interface CoachPrompt {
  id: string;
  label: string;
}

export const COACH_PROMPTS: CoachPrompt[] = [
  { id: "hoje", label: "Qual é o treino de hoje?" },
  { id: "plano", label: "Como está meu plano da semana?" },
  { id: "progresso", label: "Estou evoluindo?" },
  { id: "suplemento", label: "O que tomar hoje?" },
  { id: "sem-tempo", label: "Só tenho 20 minutos" },
  { id: "dor", label: "Estou dolorido" },
  { id: "desafio", label: "Me sugere um desafio" },
];

export function coachReply(promptId: string, state: AppState): string {
  const profile = state.profile;
  if (!profile) return "Complete seu perfil de performance para eu montar o próximo passo.";

  const plan = buildWeeklyPlan(profile, state.sessions);
  const today = planDayForToday(plan);
  const recent = sessionsInLastDays(state.sessions, 7);
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const st = streak(state.sessions);

  switch (promptId) {
    case "hoje":
      return today
        ? `Hoje é ${today.title} — ${today.focus}. ${today.exercises.length} exercícios, cerca de ${today.estimatedMin} minutos. Abra a aba Treino e comece pelo primeiro movimento.`
        : "Hoje é dia de descanso ativo: 20 a 30 minutos de caminhada e mobilidade já bastam.";
    case "plano":
      return `Seu plano tem ${plan.length} treinos por semana com foco em ${GOAL_LABEL[profile.goal].toLowerCase()}. Nos últimos 7 dias você fez ${recent.length} de ${profile.daysPerWeek}. ${
        recent.length >= profile.daysPerWeek
          ? "Semana cumprida, mantenha o ritmo."
          : "Encaixe os treinos que faltam nos próximos dias."
      }`;
    case "progresso": {
      const weakest = [...dims].sort((a, b) => a.score - b.score)[0]!;
      return `Seu score de performance está em ${score}/100. O ponto mais fraco agora é ${weakest.label.toLowerCase()} (${weakest.score}). Vou priorizar isso nas próximas semanas.`;
    }
    case "suplemento": {
      const recommended = PRODUCTS.filter((p) => p.goals.includes(profile.goal)).slice(0, 3);
      return `Para o seu objetivo: ${recommended
        .map((p) => `${p.name} (${p.timing.toLowerCase()})`)
        .join(", ")}. Marque na aba Suplementos para eu acompanhar sua aderência.`;
    }
    case "sem-tempo":
      return today
        ? `Versão curta do ${today.title}: faça os 3 primeiros exercícios (${today.exercises
            .slice(0, 3)
            .map((e) => e.name)
            .join(", ")}) com descanso de 45 s. Treino curto conta para o seu streak.`
        : "Faça 15 minutos de circuito: agachamento, flexão e prancha em 4 voltas.";
    case "dor":
      return `Dor muscular normal com ${st} dia(s) de streak é sinal de estímulo. Reduza a carga em 10% hoje, aumente a água e priorize sono. Se a dor for articular, pule o movimento e troque por uma variação sem dor.`;
    case "desafio": {
      const open = CHALLENGES.filter((c) => !state.challenges.includes(c.id));
      const pick = open[0] ?? CHALLENGES[0];
      return `Entra no "${pick.title}": ${pick.description} Você já tem ${state.sessions.length} treino(s) registrados, então o ritmo ajuda.`;
    }
    default:
      return "Posso ajustar treino, volume, suplementação e desafios. Escolha uma das opções abaixo.";
  }
}

export function coachFreeform(text: string, state: AppState) {
  const t = text.toLowerCase();
  if (t.includes("treino") && (t.includes("hoje") || t.includes("agora"))) return coachReply("hoje", state);
  if (t.includes("suplement") || t.includes("whey") || t.includes("creatina")) return coachReply("suplemento", state);
  if (t.includes("dor") || t.includes("cansad")) return coachReply("dor", state);
  if (t.includes("desafio")) return coachReply("desafio", state);
  if (t.includes("peso") || t.includes("evolu") || t.includes("progress")) return coachReply("progresso", state);
  if (t.includes("tempo") || t.includes("minuto")) return coachReply("sem-tempo", state);
  return coachReply("plano", state);
}
