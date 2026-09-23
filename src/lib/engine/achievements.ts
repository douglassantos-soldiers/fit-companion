import { ACHIEVEMENTS, type AchievementId } from "@/data/achievements";
import { streak } from "@/lib/engine/dimensions";
import { currentPersonalRecords } from "@/lib/training/prs";
import type { AppState } from "@/lib/types";

export function evaluateAchievements(state: AppState): AchievementId[] {
  const unlocked: AchievementId[] = [];
  const sessions = state.sessions;
  const volume = sessions.reduce((sum, s) => sum + (s.volumeKg || 0), 0);
  const st = streak(sessions, { freezeUsedDates: state.freezeUsedDates });
  const hasWeightPr = currentPersonalRecords(sessions).some((p) => p.prType === "WEIGHT_PR");

  if (sessions.length >= 1) unlocked.push("first-workout");
  if (hasWeightPr) unlocked.push("first-pr");
  if (st >= 7) unlocked.push("streak-7");
  if (st >= 30) unlocked.push("streak-30");
  if (sessions.length >= 100) unlocked.push("workouts-100");
  if (volume >= 100_000) unlocked.push("volume-100k");
  if ((state.challenges ?? []).length >= 1) unlocked.push("first-challenge");
  if (state.hasFollowedSomeone) unlocked.push("first-friend");

  return unlocked;
}

export function pendingAchievements(state: AppState): AchievementId[] {
  const earned = new Set(state.earnedBadges ?? []);
  return evaluateAchievements(state).filter((id) => !earned.has(id));
}

export function grantPendingAchievements(state: AppState): { state: AppState; unlocked: AchievementId[] } {
  const unlocked = pendingAchievements(state);
  if (!unlocked.length) return { state, unlocked: [] };
  return {
    state: { ...state, earnedBadges: [...(state.earnedBadges ?? []), ...unlocked] },
    unlocked,
  };
}

export function achievementTitles(ids: string[]): string[] {
  return ids.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.title ?? id);
}
