import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { todayKey, type AppState } from "@/lib/types";

export type WeekNutritionSummary = {
  daysLogged: number;
  daysWindow: number;
  proteinHitDays: number;
  proteinHitPct: number;
  kcalTrend: number;
  gateCopy: string | null;
  kcalCopy: string | null;
};

function dateNDaysAgo(n: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

/** Human-readable week nutrition mirror for /nutricao Semana tab. */
export function weekNutritionSummary(
  state: AppState,
  opts?: {
    kcalTrend?: number;
    reasonSeeds?: string[];
    now?: Date;
  },
): WeekNutritionSummary | null {
  const profile = state.profile;
  if (!profile) return null;
  const now = opts?.now ?? new Date();
  const goals = nutritionGoals(profile);
  const daysWindow = 7;
  let daysLogged = 0;
  let proteinHitDays = 0;

  for (let i = 0; i < daysWindow; i += 1) {
    const date = dateNDaysAgo(i, now);
    const dayMeals = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === date);
    if (!dayMeals.length) continue;
    daysLogged += 1;
    const totals = dayNutritionTotals(state.meals ?? [], date);
    if (totals.proteinG >= goals.proteinG * 0.9) proteinHitDays += 1;
  }

  const kcalTrend = opts?.kcalTrend ?? 0;
  const seeds = opts?.reasonSeeds ?? [];
  let gateCopy: string | null = null;
  if (seeds.includes("incomplete_logging")) {
    gateCopy = "Registro incompleto — o motor segura o ajuste fino até você logar mais dias.";
  } else if (seeds.includes("adherence_gate")) {
    gateCopy = "Aderência de kcal baixa — priorize consistência antes de mudar a meta.";
  }

  const kcalCopy =
    Math.abs(kcalTrend) >= 100
      ? `Ajuste semanal: ${kcalTrend > 0 ? "+" : ""}${kcalTrend} kcal${
          seeds.some((s) => s.startsWith("weight_trend")) ? " (tendência de peso)" : ""
        }`
      : daysLogged < 3
        ? "Com 3+ dias logados o motor calibra kcal com mais confiança."
        : null;

  return {
    daysLogged,
    daysWindow,
    proteinHitDays,
    proteinHitPct: Math.round((proteinHitDays / daysWindow) * 100),
    kcalTrend,
    gateCopy,
    kcalCopy,
  };
}

/** Living Plan why lines relevant to nutrition (calories / protein). */
export function nutritionWhyLines(
  whyByChange: Array<{ key: string; label: string; reason: string }> | null | undefined,
  limit = 2,
): Array<{ key: string; label: string; reason: string }> {
  if (!whyByChange?.length) return [];
  const keys = new Set(["calories", "protein", "kcal", "proteina"]);
  const hit = whyByChange.filter((w) => keys.has(w.key) || /calor|prote/i.test(w.key + w.label));
  return (hit.length ? hit : whyByChange).slice(0, limit);
}

/** Toast micro-feedback after logging protein. */
export function postLogProteinFeedback(
  proteinAdded: number,
  proteinNow: number,
  proteinGoal: number,
): string {
  const missing = Math.round(proteinGoal - proteinNow);
  if (proteinGoal <= 0) return `+${Math.round(proteinAdded)} g proteína`;
  if (missing <= 0) return `+${Math.round(proteinAdded)} g · meta batida`;
  return `+${Math.round(proteinAdded)} g · faltam ${missing} g`;
}
