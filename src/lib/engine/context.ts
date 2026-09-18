/**
 * Context Engine — "How is this person today?"
 * Engines compute; Context aggregates signals + why explanations.
 * Does NOT invent goals from Shopify products.
 */
import { buildCustomer360FromState, type Customer360 } from "@/lib/customer360";
import { computeLearningInsights } from "@/lib/engine/learning";
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { performanceDimensions, performanceScore, streak } from "@/lib/engine/dimensions";
import { todayKey, type AppState } from "@/lib/types";

export type ContextSignal = {
  key: string;
  direction: "up" | "down" | "stable" | "risk";
  label: string;
  why: string;
};

export type UserContext = {
  date: string;
  signals: ContextSignal[];
  headline: string | null;
  why: string[];
  customer360: Customer360;
  performanceScore: number | null;
  adherenceScore: number | null;
};

export function buildUserContext(state: AppState, userId?: string | null): UserContext {
  const c360 = buildCustomer360FromState(state, userId != null ? { userId } : undefined);
  const insights = computeLearningInsights(state);
  const signals: ContextSignal[] = [];
  const why: string[] = [];

  if (c360.recovery.fatigueSignal) {
    signals.push({
      key: "recovery",
      direction: "down",
      label: "Recuperação",
      why: "Sinais de fadiga (RPE alto e/ou sono baixo).",
    });
    why.push("Recuperação abaixo do seu padrão recente.");
  }

  if (insights && insights.proteinAdherence7d < 0.7) {
    signals.push({
      key: "protein",
      direction: "down",
      label: "Proteína",
      why: `Aderência proteica 7d em ${Math.round(insights.proteinAdherence7d * 100)}%.`,
    });
    why.push("Proteína abaixo da meta nos últimos dias.");
  }

  if (insights?.adaptations.weekHint === "deload") {
    signals.push({
      key: "training_load",
      direction: "up",
      label: "Carga de treino",
      why: "RPE difícil em sequência — deload sugerido.",
    });
    why.push("Carga de treino elevada; volume pode ser reduzido hoje.");
  }

  if (c360.nutrition.weightTrendKg7d != null && c360.nutrition.weightTrendKg7d <= -0.5) {
    signals.push({
      key: "weight_trend",
      direction: "down",
      label: "Peso",
      why: `Tendência de ${c360.nutrition.weightTrendKg7d} kg em 7 dias.`,
    });
  }

  for (const r of Object.values(c360.supplements.restockEstimates)) {
    if (r.daysLeft <= 12) {
      signals.push({
        key: `restock_${r.productId}`,
        direction: "risk",
        label: "Reposição",
        why: `Estoque estimado de ${r.productId}: ~${r.daysLeft} dias (confiança ${Math.round(r.confidence * 100)}%).`,
      });
      why.push(`Estoque estimado de ${r.productId} pode estar próximo do fim.`);
    }
  }

  // Weekday skip pattern (simple learning feature)
  const byWeekday = new Map<number, number>();
  for (const s of state.sessions) {
    const wd = new Date(s.date).getDay();
    byWeekday.set(wd, (byWeekday.get(wd) ?? 0) + 1);
  }
  const todayWd = new Date().getDay();
  const todayCount = byWeekday.get(todayWd) ?? 0;
  const avg =
    [...byWeekday.values()].reduce((a, b) => a + b, 0) / Math.max(1, byWeekday.size);
  if (state.sessions.length >= 8 && todayCount < avg * 0.5) {
    signals.push({
      key: "weekday_skip",
      direction: "risk",
      label: "Padrão semanal",
      why: "Você costuma treinar menos neste dia da semana.",
    });
    why.push("Você costuma pular treinos neste dia — sessão ajustada para ser mais curta ajuda.");
  }

  const profile = state.profile;
  let perfScore: number | null = null;
  let adherenceScore: number | null = null;
  if (profile) {
    const dims = performanceDimensions(state, profile);
    const perfDims = dims.filter((d) =>
      ["forca", "resistencia", "consistencia", "recuperacao", "sono"].includes(d.key),
    );
    const adhereDims = dims.filter((d) =>
      ["nutricao", "suplementacao", "habitos"].includes(d.key),
    );
    perfScore = performanceScore(perfDims);
    adherenceScore = performanceScore(adhereDims);
  }

  if (profile) {
    const goals = nutritionGoals(profile, insights);
    const totals = dayNutritionTotals(state.meals ?? []);
    if (totals.proteinG < goals.proteinG * 0.85 && totals.count > 0) {
      why.push(`Ontem/hoje a proteína ficou abaixo da meta (${Math.round(totals.proteinG)}g vs ${goals.proteinG}g).`);
    }
  }

  const headline =
    why[0] ??
    (signals.length
      ? signals[0]!.why
      : streak(state.sessions) > 0
        ? `Sequência de ${streak(state.sessions)} dias — mantenha o ritmo.`
        : null);

  return {
    date: todayKey(),
    signals,
    headline,
    why: why.slice(0, 5),
    customer360: c360,
    performanceScore: perfScore,
    adherenceScore,
  };
}
