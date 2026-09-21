/**
 * Activity Normalization — Strava / Garmin / app session / ActivityLogEntry / manual → Activity.
 * Reuses wearable proof rules. Does not store tokens.
 */
import {
  activityDedupeKey,
  type Activity,
  type ActivitySource,
  type ActivityType,
} from "@/lib/athlete/types";
import type {
  ActivityLogEntry,
  ActivityLogKind,
  ProofSource,
  ProofStatus,
  SessionLog,
} from "@/lib/types";
import {
  normalizeGarminActivities,
  normalizeStravaActivities,
  proofStatusForProvider,
  samplesToActivityLogs,
  type WearableProvider,
} from "@/lib/wearables/normalize";

function isoFromDateKey(date: string, fallback = "T12:00:00.000Z"): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(date)) return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}${fallback}`;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function sourceFromProof(source: ProofSource): ActivitySource {
  if (source === "strava") return "strava";
  if (source === "garmin") return "garmin";
  if (source === "app_session") return "app";
  if (source === "app_manual") return "manual";
  return "wearable";
}

function typeFromLogKind(kind: ActivityLogKind, rawType?: string): ActivityType {
  const t = (rawType ?? "").toLowerCase();
  if (kind === "football" || t.includes("soccer") || t.includes("football")) return "football";
  if (t.includes("walk") || t.includes("hike")) return "walk";
  if (t.includes("cycl") || t.includes("bike") || t.includes("ride")) return "cycling";
  if (kind === "run_km") return "run";
  if (kind === "steps") return "cardio";
  return "cardio";
}

function typeFromSession(_session: SessionLog): ActivityType {
  return "strength";
}

export function activityFromLogEntry(
  userId: string,
  entry: ActivityLogEntry,
  rawType?: string,
): Activity {
  const source = sourceFromProof(entry.source);
  const type = typeFromLogKind(entry.kind, rawType);
  const startedAt = isoFromDateKey(entry.date);
  const row: Activity = {
    id: entry.id,
    userId,
    source,
    type,
    startedAt,
    createdAt: startedAt,
    proofStatus: entry.status,
  };
  if (entry.externalId) row.externalId = entry.externalId;
  if (entry.kind === "run_km") {
    row.distanceM = Math.round(entry.value * 1000);
    row.metrics = { distanceKm: entry.value };
  } else if (entry.kind === "steps") {
    row.metrics = { steps: entry.value };
  } else if (entry.kind === "football") {
    row.metrics = { durationMin: 90 };
    row.durationSec = 90 * 60;
  }
  return row;
}

export function activityFromSession(userId: string, session: SessionLog): Activity {
  const startedAt = isoFromDateKey(session.date);
  const durationSec = Math.max(0, Math.round((session.durationMin ?? 0) * 60));
  return {
    id: `app:${session.id}`,
    userId,
    source: "app",
    type: typeFromSession(session),
    startedAt,
    createdAt: startedAt,
    proofStatus: "self_reported",
    externalId: session.id,
    durationSec,
    metrics: { durationMin: session.durationMin, rawKind: "strength" },
  };
}

export function activityFromManual(opts: {
  userId: string;
  id: string;
  type: ActivityType;
  startedAt: string;
  durationSec?: number;
  distanceM?: number;
  calories?: number;
}): Activity {
  const startedAt = isoFromDateKey(opts.startedAt);
  const row: Activity = {
    id: opts.id,
    userId: opts.userId,
    source: "manual",
    type: opts.type,
    startedAt,
    createdAt: startedAt,
    proofStatus: "self_reported",
    externalId: opts.id,
  };
  if (opts.durationSec != null) row.durationSec = opts.durationSec;
  if (opts.distanceM != null) row.distanceM = opts.distanceM;
  if (opts.calories != null) row.calories = opts.calories;
  return row;
}

/** Provider payload → Activities (richer than WearableSample). Falls back to log entries. */
export function activitiesFromWearableLogs(
  userId: string,
  logs: ActivityLogEntry[],
  provider: WearableProvider,
  rawTypes?: Record<string, string>,
): Activity[] {
  const status = proofStatusForProvider(provider, "oauth");
  return logs.map((entry) => {
    const next = activityFromLogEntry(userId, entry, rawTypes?.[entry.externalId ?? entry.id]);
    next.proofStatus = status;
    next.source = provider === "strava" || provider === "garmin" ? provider : "wearable";
    next.device = provider;
    return next;
  });
}

export function activitiesFromStravaPayload(userId: string, payload: unknown): Activity[] {
  return activitiesFromWearableLogs(
    userId,
    samplesToActivityLogs(normalizeStravaActivities(payload), "oauth"),
    "strava",
  );
}

export function activitiesFromGarminPayload(userId: string, payload: unknown): Activity[] {
  return activitiesFromWearableLogs(
    userId,
    samplesToActivityLogs(normalizeGarminActivities(payload), "oauth"),
    "garmin",
  );
}

export function dedupeActivities(rows: Activity[]): Activity[] {
  const map = new Map<string, Activity>();
  for (const row of rows) map.set(activityDedupeKey(row), row);
  return [...map.values()].sort(
    (a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
  );
}

/** Backward adapter so challenges keep reading ActivityLogEntry. */
export function activityToLogEntry(activity: Activity): ActivityLogEntry | null {
  let kind: ActivityLogKind | null = null;
  let value = 0;
  if (activity.type === "football") {
    kind = "football";
    value = 1;
  } else if (activity.type === "run" || activity.type === "walk" || activity.type === "cycling") {
    kind = "run_km";
    value =
      activity.metrics?.distanceKm ?? (activity.distanceM != null ? activity.distanceM / 1000 : 0);
  } else if (activity.type === "cardio" && activity.metrics?.steps) {
    kind = "steps";
    value = activity.metrics.steps;
  } else if (activity.metrics?.steps) {
    kind = "steps";
    value = activity.metrics.steps;
  }
  if (!kind || value <= 0) return null;

  const source: ProofSource =
    activity.source === "strava"
      ? "strava"
      : activity.source === "garmin"
        ? "garmin"
        : activity.source === "app"
          ? "app_session"
          : activity.source === "manual"
            ? "app_manual"
            : "wearable";

  const entry: ActivityLogEntry = {
    id: activity.id,
    date: dateKey(activity.startedAt),
    kind,
    value,
    source,
    status: activity.proofStatus,
  };
  if (activity.externalId) entry.externalId = activity.externalId;
  return entry;
}

export function activitiesToLogEntries(rows: Activity[]): ActivityLogEntry[] {
  const out: ActivityLogEntry[] = [];
  for (const row of rows) {
    const log = activityToLogEntry(row);
    if (log) out.push(log);
  }
  return out;
}

export function proofStatusOf(activity: Activity): ProofStatus {
  return activity.proofStatus;
}
