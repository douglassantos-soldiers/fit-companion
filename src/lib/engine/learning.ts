import { PRODUCTS } from "@/data/products";
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { monthlyDoseAdherence } from "@/lib/engine/supplements";
import { todayKey, type AppState, type Profile } from "@/lib/types";

export interface LearningAdaptations {
  kcalDelta: number;
  proteinBias: "up" | "hold";
  weekHint: "deload" | "push" | "normal" | null;
  preferGreenMeals: boolean;
}

export interface LearningInsights {
  proteinAdherence7d: number;
  weightTrendKg7d: number | null;
  supplementAdherence30d: number;
  hardRpeStreak: number;
  reasons: string[];
  adaptations: LearningAdaptations;
}

function dateNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

function rpeStreak(sessions: AppState["sessions"], rpe: "dificil" | "facil") {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const s of sorted) {
    if (s.rpe === rpe) streak += 1;
    else break;
  }
  return streak;
}

function weightTrend7d(weights: AppState["weights"]): number | null {
  if (weights.length < 2) return null;
  const cutoff = dateNDaysAgo(7);
  const inWindow = weights.filter((w) => w.date >= cutoff).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (inWindow.length >= 2) {
    return Math.round((inWindow[inWindow.length - 1]!.weightKg - inWindow[0]!.weightKg) * 10) / 10;
  }
  const sorted = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1]!;
  const earlier = sorted.filter((w) => w.date < last.date && w.date >= cutoff);
  const prev = earlier[earlier.length - 1] ?? sorted[sorted.length - 2];
  if (!prev) return null;
  return Math.round((last.weightKg - prev.weightKg) * 10) / 10;
}

function proteinAdherence7d(state: AppState, profile: Profile) {
  const base = nutritionGoals(profile);
  let sum = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = dateNDaysAgo(i);
    const totals = dayNutritionTotals(state.meals ?? [], date);
    sum += Math.min(1, totals.proteinG / Math.max(1, base.proteinG));
  }
  return Math.round((sum / 7) * 100) / 100;
}

/** Recompute insights from results — no persistence. */
export function computeLearningInsights(state: AppState): LearningInsights | null {
  const profile = state.profile;
  if (!profile) return null;

  const proteinAdherence = proteinAdherence7d(state, profile);
  const trend = weightTrend7d(state.weights);
  const hardStreak = rpeStreak(state.sessions, "dificil");
  const easyStreak = rpeStreak(state.sessions, "facil");

  const routine = state.supplementRoutine.length
    ? state.supplementRoutine
    : PRODUCTS.filter((p) => p.goals.includes(profile.goal))
        .slice(0, 3)
        .map((p) => p.id);
  const monthAdh = monthlyDoseAdherence(state.supplementLogs, routine);
  const supplementAdherence30d = monthAdh.pct / 100;

  const reasons: string[] = [];
  let kcalDelta = 0;
  let proteinBias: "up" | "hold" = "hold";
  let preferGreenMeals = false;
  let weekHint: LearningAdaptations["weekHint"] = null;

  if (proteinAdherence < 0.7) {
    proteinBias = "up";
    preferGreenMeals = true;
    reasons.push(
      `Proteína em ${Math.round(proteinAdherence * 100)}% da meta na semana — priorize presets verdes.`,
    );
  }

  if (trend !== null && trend > 0.5 && profile.goal === "gordura") {
    kcalDelta = -150;
    reasons.push(`Peso subiu ${trend.toFixed(1)} kg em 7 dias com objetivo de emagrecer — kcal −150.`);
  }

  if (trend !== null && trend < -0.5 && profile.goal === "massa") {
    kcalDelta = 150;
    reasons.push(`Peso caiu ${Math.abs(trend).toFixed(1)} kg em 7 dias com objetivo de massa — kcal +150.`);
  }

  if (routine.length > 0 && supplementAdherence30d < 0.5) {
    reasons.push(`Aderência de suplementos em ${monthAdh.pct}% no mês — marque as doses no horário.`);
  }

  if (hardStreak >= 2) {
    weekHint = "deload";
    reasons.push(`${hardStreak} treinos seguidos com RPE difícil — semana aponta para deload.`);
  } else if (easyStreak >= 2) {
    weekHint = "push";
    reasons.push(`${easyStreak} treinos seguidos com RPE fácil — semana aponta para push.`);
  }

  return {
    proteinAdherence7d: proteinAdherence,
    weightTrendKg7d: trend,
    supplementAdherence30d,
    hardRpeStreak: hardStreak,
    reasons,
    adaptations: { kcalDelta, proteinBias, weekHint, preferGreenMeals },
  };
}

export function topLearningInsight(state: AppState): string | null {
  const insights = computeLearningInsights(state);
  return insights?.reasons[0] ?? null;
}

/** Hint de semana utilizável pelo motor (só deload/push). */
export function learningWeekHint(state: AppState): "deload" | "push" | null {
  const hint = computeLearningInsights(state)?.adaptations.weekHint;
  return hint === "deload" || hint === "push" ? hint : null;
}
