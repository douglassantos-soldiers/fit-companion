import { brandLevel, isWarriorPlus } from "@/lib/engine/brand-level";
import { todayKey } from "@/lib/types";
import type { AppState } from "@/lib/types";

export type HomePersona = "novo" | "consistente" | "inativo" | "avancado";

function daysBetween(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T12:00:00`);
  const b = new Date(`${toKey}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function lastSessionDate(state: AppState): string | null {
  const dates = state.sessions.map((s) => s.date.slice(0, 10)).sort();
  return dates[dates.length - 1] ?? null;
}

function accountAgeDays(state: AppState, now = new Date()): number {
  const created = state.profile?.createdAt;
  if (!created) return 0;
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

function trainedThisIsoWeek(state: AppState, now = new Date()): boolean {
  const today = todayKey(now);
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() - day);
  const weekStart = todayKey(monday);
  return state.sessions.some((s) => {
    const key = s.date.slice(0, 10);
    return key >= weekStart && key <= today;
  });
}

/**
 * Home layout persona. Priority: inativo > novo > avancado > consistente.
 */
export function homePersona(state: AppState, now = new Date()): HomePersona {
  const sessions = state.sessions.length;
  const last = lastSessionDate(state);
  const today = todayKey(now);

  if (sessions === 0) return "novo";
  if (last && daysBetween(last, today) >= 8) return "inativo";
  if (sessions < 2 && accountAgeDays(state, now) < 7) return "novo";

  const level = state.profile?.level;
  const rank = brandLevel(state).rank;
  if (sessions >= 20 && (level === "avancado" || isWarriorPlus(rank))) return "avancado";

  if (trainedThisIsoWeek(state, now)) return "consistente";
  return "consistente";
}
