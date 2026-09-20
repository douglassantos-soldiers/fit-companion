/**
 * Adherence helpers for Behavior Profile / Triggers.
 */
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { streak } from "@/lib/engine/dimensions";
import { todayKey, type AppState } from "@/lib/types";

function dateNDaysAgo(n: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

export function trainingAdherence7d(state: AppState): number {
  const target = Math.max(1, state.profile?.daysPerWeek ?? 3);
  const weekTarget = Math.min(7, Math.round((target / 7) * 7));
  let trained = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = dateNDaysAgo(i);
    if ((state.sessions ?? []).some((s) => s.date.slice(0, 10) === date)) trained += 1;
  }
  return Math.min(1, Math.round((trained / Math.max(1, weekTarget)) * 100) / 100);
}

export function mealAdherence7d(state: AppState): number {
  const profile = state.profile;
  if (!profile) return 0;
  const goals = nutritionGoals(profile);
  let days = 0;
  let sum = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = dateNDaysAgo(i);
    const meals = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === date);
    if (!meals.length) continue;
    days += 1;
    const totals = dayNutritionTotals(state.meals ?? [], date);
    sum += Math.min(1, totals.proteinG / Math.max(1, goals.proteinG));
  }
  if (!days) return 0;
  return Math.round((sum / days) * 100) / 100;
}

export function sleepBehavior7d(state: AppState): number {
  const checks = Object.values(state.dayCheckIns ?? {}).filter((c) => {
    const lim = dateNDaysAgo(7);
    return c.date >= lim;
  });
  if (!checks.length) {
    const typ = state.profile?.typicalSleepHours;
    if (typ == null) return 0.5;
    return Math.min(1, Math.max(0, (typ - 4) / 4));
  }
  const avg = checks.reduce((s, c) => s + c.sleepHours, 0) / checks.length;
  return Math.min(1, Math.max(0, Math.round(((avg - 4) / 4) * 100) / 100));
}

export function consistencyScore(state: AppState): number {
  const s = streak(state.sessions ?? [], { freezeUsedDates: state.freezeUsedDates });
  const train = trainingAdherence7d(state);
  return Math.round((Math.min(1, s / 7) * 0.4 + train * 0.6) * 100) / 100;
}

export function fridayTrainingGaps(state: AppState): { count: number; evidenceDates: string[] } {
  const totalSessions = state.sessions?.length ?? 0;
  // Need baseline training evidence — empty calendars are not a Friday pattern
  if (totalSessions < 6) return { count: 0, evidenceDates: [] };

  const byFri: Record<string, boolean> = {};
  const fridays: string[] = [];
  for (let i = 0; i < 28; i += 1) {
    const date = dateNDaysAgo(i);
    const wd = new Date(`${date}T12:00:00`).getDay();
    if (wd !== 5) continue;
    fridays.push(date);
    byFri[date] = (state.sessions ?? []).some((s) => s.date.slice(0, 10) === date);
  }
  const missed = fridays.filter((d) => !byFri[d]);
  // Require that other weekdays have some training (not total inactivity)
  const nonFriSessions = (state.sessions ?? []).filter((s) => {
    const wd = new Date(`${s.date.slice(0, 10)}T12:00:00`).getDay();
    return wd !== 5;
  }).length;
  if (nonFriSessions < 4) return { count: 0, evidenceDates: [] };
  return { count: missed.length, evidenceDates: missed.slice(0, 6) };
}

export function mealLoggingDropDays(state: AppState): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 14; i += 1) {
    const date = dateNDaysAgo(i);
    const prev = dateNDaysAgo(i + 1);
    const todayCount = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === date).length;
    const prevCount = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === prev).length;
    if (prevCount >= 2 && todayCount === 0) out.push(date);
  }
  return out;
}

export function lowSleepStreakDays(state: AppState): string[] {
  const sorted = Object.values(state.dayCheckIns ?? {})
    .filter((c) => c.sleepHours < 6)
    .sort((a, b) => b.date.localeCompare(a.date));
  const out: string[] = [];
  for (const c of sorted) {
    if (out.length && !isConsecutive(out[out.length - 1]!, c.date)) break;
    out.push(c.date);
  }
  return out;
}

function isConsecutive(later: string, earlier: string) {
  const a = new Date(`${later}T12:00:00`);
  const b = new Date(`${earlier}T12:00:00`);
  const diff = (a.getTime() - b.getTime()) / 86400000;
  return diff >= 0.9 && diff <= 1.1;
}
