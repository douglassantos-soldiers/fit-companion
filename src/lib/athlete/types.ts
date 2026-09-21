/**
 * Athlete Network domain — normalized physical activity (not social feed posts).
 * activity_events remain the social timeline. AppState.activityLogs is cache/offline.
 */
import type { ProofStatus } from "@/lib/types";

export const ACTIVITY_SOURCES = ["app", "strava", "garmin", "wearable", "manual"] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export const ACTIVITY_TYPES = [
  "strength",
  "run",
  "walk",
  "football",
  "cycling",
  "cardio",
  "challenge",
  "manual",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ActivityMetrics = {
  steps?: number;
  distanceKm?: number;
  durationMin?: number;
  calories?: number;
  rawKind?: string;
};

export type Activity = {
  id: string;
  userId: string;
  source: ActivitySource;
  type: ActivityType;
  startedAt: string;
  createdAt: string;
  proofStatus: ProofStatus;
  durationSec?: number;
  distanceM?: number;
  calories?: number;
  externalId?: string;
  device?: string;
  metrics?: ActivityMetrics;
};

export function activityDedupeKey(row: Pick<Activity, "source" | "externalId" | "id">): string {
  if (row.externalId) return `${row.source}:${row.externalId}`;
  return row.id;
}

export function isActivitySource(value: unknown): value is ActivitySource {
  return ACTIVITY_SOURCES.includes(value as ActivitySource);
}

export function isActivityType(value: unknown): value is ActivityType {
  return ACTIVITY_TYPES.includes(value as ActivityType);
}
