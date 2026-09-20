import { streak } from "@/lib/engine/dimensions";
import { lifetimeXp } from "@/lib/engine/xp";
import type { AppState } from "@/lib/types";

export type BrandRank = "recruta" | "soldier" | "warrior" | "elite" | "legend";

export const BRAND_RANK_LABEL: Record<BrandRank, string> = {
  recruta: "Recruta",
  soldier: "Soldier",
  warrior: "Warrior",
  elite: "Elite",
  legend: "Legend",
};

export interface BrandLevel {
  level: number;
  rank: BrandRank;
  label: string;
  lifetimeXp: number;
  streakWeeks: number;
  xpToNext: number | null;
}

export function rankForLevel(level: number): BrandRank {
  if (level >= 50) return "legend";
  if (level >= 20) return "elite";
  if (level >= 10) return "warrior";
  if (level >= 5) return "soldier";
  return "recruta";
}

export function isWarriorPlus(rank: BrandRank): boolean {
  return rank === "warrior" || rank === "elite" || rank === "legend";
}

/** 1 + floor(lifetimeXp / 50) + floor(streakWeeks / 2), cap 50. */
export function brandLevel(state: AppState): BrandLevel {
  const xp = lifetimeXp(state);
  const streakDays = streak(state.sessions, { freezeUsedDates: state.freezeUsedDates });
  const streakWeeks = Math.floor(Math.max(0, streakDays) / 7);
  const level = Math.min(50, 1 + Math.floor(xp / 50) + Math.floor(streakWeeks / 2));
  const rank = rankForLevel(level);
  const xpToNext = level >= 50 ? null : 50 - (xp % 50);
  return {
    level,
    rank,
    label: BRAND_RANK_LABEL[rank],
    lifetimeXp: xp,
    streakWeeks,
    xpToNext,
  };
}
