import type { DayCheckIn, Profile } from "@/lib/types";

export const SESSION_DURATION_OPTIONS = [30, 45, 60, 90] as const;
export type SessionDurationMin = (typeof SESSION_DURATION_OPTIONS)[number];

export const SESSION_DURATION_LABEL: Record<SessionDurationMin, string> = {
  30: "Até 30 min",
  45: "30–45 min",
  60: "45–60 min",
  90: "60–90 min",
};

export function resolvedAvailableMin(
  checkIn?: Pick<DayCheckIn, "availableMin"> | null,
  profile?: Pick<Profile, "typicalSessionMin"> | null,
  fallback = 60,
): number {
  if (checkIn?.availableMin != null) return checkIn.availableMin;
  if (profile?.typicalSessionMin != null && profile.typicalSessionMin > 0) {
    return profile.typicalSessionMin;
  }
  return fallback;
}
