import { ONBOARDING_TIPS, type OnboardingTip } from "@/data/onboarding-tips";
import { streak } from "@/lib/engine/dimensions";
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import type { AppState, Profile, SessionLog } from "@/lib/types";
import { todayKey } from "@/lib/types";

export function streakAtRisk(
  sessions: SessionLog[],
  now = new Date(),
  freezeUsedDates: string[] = [],
): boolean {
  const st = streak(sessions, { freezeUsedDates });
  if (st <= 0) return false;
  const today = todayKey(now);
  const trainedToday = sessions.some((s) => s.date.slice(0, 10) === today);
  const frozeToday = freezeUsedDates.some((d) => d.slice(0, 10) === today);
  if (trainedToday || frozeToday) return false;

  const hour = now.getHours();
  const minutesToMidnight = (23 - hour) * 60 + (60 - now.getMinutes());
  return hour >= 12 || minutesToMidnight <= 6 * 60;
}

export interface DaySummary {
  trained: boolean;
  proteinPct: number;
  waterPct: number;
  supplementsDone: number;
  supplementsTarget: number;
  streak: number;
  xp: number;
  frozeToday: boolean;
}

export function daySummary(state: AppState): DaySummary {
  const profile = state.profile;
  const goals = profile ? nutritionGoals(profile) : { proteinG: 150, waterMl: 2500, kcal: 2000, mealsTarget: 4 };
  const nutrition = dayNutritionTotals(state.meals ?? []);
  const metrics = state.days[todayKey()] ?? { date: todayKey(), waterMl: 0, meals: 0 };
  const routineLen = state.supplementRoutine.length || 3;
  const taken = state.supplementLogs[todayKey()] ?? [];
  const trained = state.sessions.some((s) => s.date.slice(0, 10) === todayKey());
  const frozeToday = (state.freezeUsedDates ?? []).some((d) => d.slice(0, 10) === todayKey());

  return {
    trained,
    proteinPct: Math.min(100, Math.round((nutrition.proteinG / Math.max(1, goals.proteinG)) * 100)),
    waterPct: Math.min(100, Math.round((metrics.waterMl / Math.max(1, goals.waterMl)) * 100)),
    supplementsDone: taken.length,
    supplementsTarget: Math.max(1, routineLen),
    streak: streak(state.sessions, { freezeUsedDates: state.freezeUsedDates }),
    xp: state.xpByDate?.[todayKey()] ?? 0,
    frozeToday,
  };
}

function daysSinceCreated(profile: Profile, now = new Date()): number {
  const created = new Date(profile.createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  const ms = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function nextOnboardingTip(profile: Profile, state: AppState): OnboardingTip | null {
  const day = daysSinceCreated(profile);
  const seen = new Set(state.seenOnboardingTips ?? []);
  const hasMeal = (state.meals ?? []).some((m) => m.date === todayKey() || m.date.slice(0, 10) === todayKey());
  const hasSession = state.sessions.length > 0;
  const hasRoutine = state.supplementRoutine.length > 0;
  const remindersOn = state.remindersEnabled === true;

  for (const tip of ONBOARDING_TIPS) {
    if (seen.has(tip.id)) continue;
    if (day < tip.minDay) continue;
    if (tip.id === "tip-first-session" && hasSession) continue;
    if (tip.id === "tip-log-meal" && hasMeal) continue;
    if (tip.id === "tip-supplements" && hasRoutine) continue;
    if (tip.id === "tip-reminders" && remindersOn) continue;
    if (tip.id === "tip-club" && day < 5) continue;
    return tip;
  }
  return null;
}

export type WeekPathState = "empty" | "partial" | "trained" | "freeze" | "today" | "miss";

export function weekPathStates(state: AppState, days: Date[]): WeekPathState[] {
  const today = todayKey();
  const trained = new Set(state.sessions.map((s) => s.date.slice(0, 10)));
  const freezes = new Set((state.freezeUsedDates ?? []).map((d) => d.slice(0, 10)));
  return days.map((d) => {
    const key = todayKey(d);
    const isToday = key === today;
    if (trained.has(key)) return isToday ? "today" : "trained";
    if (freezes.has(key)) return "freeze";
    if (isToday) return "today";
    if (key > today) return "empty";
    const xp = state.xpByDate?.[key] ?? 0;
    if (xp > 0) return "partial";
    return "miss";
  });
}
