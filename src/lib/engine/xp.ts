import { DAILY_XP_GOAL, todayKey, type AppState } from "@/lib/types";
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";

export const XP = {
  session: 15,
  express: 10,
  pr: 2,
  meal: 2,
  mealCap: 4,
  waterGoal: 2,
  supplementsComplete: 1,
  kudos: 1,
  kudosCap: 3,
  questsCompleteBonus: 5,
} as const;

export function lifetimeXp(state: Pick<AppState, "xpByDate">): number {
  return Object.values(state.xpByDate ?? {}).reduce((sum, n) => sum + Math.max(0, n), 0);
}

export function dailyXp(state: AppState, date = todayKey()): number {
  return Math.max(0, state.xpByDate?.[date] ?? 0);
}

export function dailyXpGoalMet(state: AppState, date = todayKey()): boolean {
  return dailyXp(state, date) >= DAILY_XP_GOAL;
}

export function xpProgressPct(state: AppState, date = todayKey()): number {
  return Math.min(100, Math.round((dailyXp(state, date) / DAILY_XP_GOAL) * 100));
}

/** Cap-aware award: returns new state slice for xp + freeze refill side effects. */
export function applyXpAward(
  state: AppState,
  amount: number,
  date = todayKey(),
): { state: AppState; awarded: number; goalJustMet: boolean } {
  if (amount <= 0) return { state, awarded: 0, goalJustMet: false };
  const before = dailyXp(state, date);
  const after = before + amount;
  const xpByDate = { ...state.xpByDate, [date]: after };
  let next: AppState = { ...state, xpByDate };
  const goalJustMet = before < DAILY_XP_GOAL && after >= DAILY_XP_GOAL;
  if (goalJustMet) {
    next = maybeGrantFreezeFromXpGoals({ ...next, xpGoalMetDates: uniqueDates([...(next.xpGoalMetDates ?? []), date]) });
  }
  return { state: next, awarded: amount, goalJustMet };
}

function uniqueDates(dates: string[]) {
  return [...new Set(dates)].sort();
}

/** +1 freeze when 5 distinct XP-goal days in the current ISO week (Mon–Sun), cap 2. */
export function maybeGrantFreezeFromXpGoals(state: AppState, now = new Date()): AppState {
  const weekDates = isoWeekDateKeys(now);
  const metThisWeek = (state.xpGoalMetDates ?? []).filter((d) => weekDates.includes(d));
  if (metThisWeek.length < 5) return state;
  const marker = `freeze-granted:${weekDates[0]}`;
  if ((state.xpGoalMetDates ?? []).includes(marker)) return state;
  return {
    ...state,
    streakFreezes: Math.min(2, (state.streakFreezes ?? 0) + 1),
    xpGoalMetDates: [...(state.xpGoalMetDates ?? []), marker],
  };
}

export function isoWeekDateKeys(now = new Date()): string[] {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return todayKey(x);
  });
}

export function weekStartKey(now = new Date()): string {
  return isoWeekDateKeys(now)[0]!;
}

export function mealXpAvailable(state: AppState, date = todayKey()): number {
  const mealsToday = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === date).length;
  // After adding one meal, count will include it — caller should check before add
  const already = Math.min(XP.mealCap, mealsToday * XP.meal);
  return Math.max(0, XP.mealCap - already);
}

export function waterGoalReached(state: AppState, date = todayKey()): boolean {
  if (!state.profile) return false;
  const goals = nutritionGoals(state.profile);
  const ml = state.days[date]?.waterMl ?? 0;
  return ml >= goals.waterMl;
}

export function supplementsComplete(state: AppState, date = todayKey()): boolean {
  const routine = state.supplementRoutine ?? [];
  if (!routine.length) return false;
  const taken = state.supplementLogs[date] ?? [];
  return routine.every((id) => taken.includes(id));
}

export function computeDerivedDailyXp(state: AppState, date = todayKey()): number {
  // Prefer ledger; fallback reconstruct for display if empty
  const ledger = state.xpByDate?.[date];
  if (ledger != null && ledger > 0) return ledger;

  let xp = 0;
  const sessions = state.sessions.filter((s) => s.date.slice(0, 10) === date);
  for (const s of sessions) xp += s.express ? XP.express : XP.session;
  const meals = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === date).length;
  xp += Math.min(XP.mealCap, meals * XP.meal);
  if (waterGoalReached(state, date)) xp += XP.waterGoal;
  if (supplementsComplete(state, date)) xp += XP.supplementsComplete;
  return xp;
}

export function nutritionProteinPct(state: AppState, date = todayKey()): number {
  if (!state.profile) return 0;
  const goals = nutritionGoals(state.profile);
  const totals = dayNutritionTotals((state.meals ?? []).filter((m) => m.date.slice(0, 10) === date));
  return Math.min(100, Math.round((totals.proteinG / Math.max(1, goals.proteinG)) * 100));
}
