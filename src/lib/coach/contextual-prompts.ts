import { COACH_PROMPTS, type CoachPrompt } from "@/lib/engine/coach";
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { todayKey, type AppState } from "@/lib/types";

/**
 * Prioritize chips from today's Living Plan / nutrition / recovery,
 * then fill with static COACH_PROMPTS (deduped by id).
 */
export function contextualCoachPrompts(state: AppState, limit = 8): CoachPrompt[] {
  const living = state.livingPlans?.[todayKey()] ?? null;
  const mode = living?.workout.mode;
  const proteinTarget = state.profile ? nutritionGoals(state.profile).proteinG : null;
  const proteinNow = dayNutritionTotals(state.meals ?? []).proteinG;
  const proteinLow =
    proteinTarget != null && proteinTarget > 0 && proteinNow < proteinTarget * 0.7;

  const contextual: CoachPrompt[] = [];

  if (mode === "express") {
    contextual.push({ id: "sem-tempo", label: "Sem tempo — express" });
  } else if (mode === "rest") {
    contextual.push({ id: "por-que-descanso", label: "Por que descanso hoje?" });
  } else if (mode === "deload") {
    contextual.push({ id: "dor", label: "Por que deload / volume baixo?" });
  } else {
    contextual.push({ id: "hoje", label: "Qual é o treino de hoje?" });
  }

  if (living?.whyByChange?.length) {
    contextual.push({ id: "por-que", label: "Por que meu plano mudou?" });
  }

  if (proteinLow) {
    contextual.push({ id: "por-que-proteina", label: "Proteína baixa — o que faço?" });
  } else {
    contextual.push({ id: "nutricao", label: "Como está minha nutrição?" });
  }

  if (living?.traffic.recovery === "red" || living?.traffic.recovery === "yellow") {
    contextual.push({ id: "por-que-descanso", label: "Recuperação fraca — o que faço?" });
  }

  contextual.push({ id: "suplemento", label: "O que tomar hoje?" });

  const seen = new Set<string>();
  const out: CoachPrompt[] = [];
  for (const p of [...contextual, ...COACH_PROMPTS]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
