import type { Profile } from "@/lib/types";

/** Default training weekdays by days-per-week (0=Sun). */
export const DEFAULT_WEEKDAY_MAP: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export function normalizeWeekdays(days: number[] | undefined): number[] {
  const uniq = [...new Set((days ?? []).map((d) => Math.round(d)).filter((d) => d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
  return uniq;
}

export function resolveTrainingWeekdays(profile: Pick<Profile, "daysPerWeek" | "trainingWeekdays">): number[] {
  const custom = normalizeWeekdays(profile.trainingWeekdays);
  if (custom.length >= 2 && custom.length <= 6) return custom;
  const days = Math.min(6, Math.max(2, profile.daysPerWeek || 3));
  return DEFAULT_WEEKDAY_MAP[days] ?? DEFAULT_WEEKDAY_MAP[3]!;
}
