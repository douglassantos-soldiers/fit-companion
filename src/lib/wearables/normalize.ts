/**
 * Wearable / proof ingest — pure mappers. Apple/Health Connect never mint verified on web.
 */
import type { ActivityLogEntry, ActivityLogKind, ProofSource, ProofStatus } from "@/lib/types";

export type WearableProvider = "strava" | "garmin" | "apple_health" | "health_connect";

export type WearableSample = {
  provider: WearableProvider;
  externalId: string;
  date: string;
  kind: ActivityLogKind;
  value: number;
};

export type IngestVia = "oauth" | "import";

const PROVIDER_SOURCE: Record<WearableProvider, ProofSource> = {
  strava: "strava",
  garmin: "garmin",
  apple_health: "apple_health",
  health_connect: "health_connect",
};

export function proofStatusForProvider(provider: WearableProvider, via: IngestVia): ProofStatus {
  if (provider === "apple_health" || provider === "health_connect") return "pending";
  return via === "oauth" ? "verified" : "pending";
}

function asDateKey(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function stravaKind(type: string): ActivityLogKind | null {
  const t = type.toLowerCase();
  if (t.includes("soccer") || t.includes("football") || t === "soccer") return "football";
  if (t.includes("run") || t.includes("walk") || t.includes("hike") || t.includes("ride")) return "run_km";
  return null;
}

function garminKind(type: string): ActivityLogKind | null {
  const t = type.toLowerCase();
  if (t.includes("soccer") || t.includes("football")) return "football";
  if (t.includes("run") || t.includes("walk") || t.includes("hike") || t.includes("cycling") || t.includes("bike")) {
    return "run_km";
  }
  return null;
}

/** Strava activity list or `{ activities: [...] }`. */
export function normalizeStravaActivities(payload: unknown): WearableSample[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { activities?: unknown }).activities)
      ? (payload as { activities: unknown[] }).activities
      : [];
  const out: WearableSample[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r["id"] ?? r["externalId"] ?? "").trim();
    const date = asDateKey(r["start_date"] ?? r["start_date_local"] ?? r["date"]);
    if (!id || !date) continue;
    const steps = num(r["steps"]);
    if (steps != null && steps > 0) {
      out.push({ provider: "strava", externalId: `${id}:steps`, date, kind: "steps", value: Math.round(steps) });
    }
    const type = String(r["type"] ?? r["sport_type"] ?? "");
    const kind = stravaKind(type);
    if (kind === "football") {
      out.push({ provider: "strava", externalId: id, date, kind: "football", value: 1 });
      continue;
    }
    const meters = num(r["distance"]);
    if (kind === "run_km" && meters != null && meters > 0) {
      out.push({
        provider: "strava",
        externalId: id,
        date,
        kind: "run_km",
        value: Math.round((meters / 1000) * 100) / 100,
      });
    }
  }
  return out;
}

/** Garmin activity list or `{ activities: [...] }`. */
export function normalizeGarminActivities(payload: unknown): WearableSample[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { activities?: unknown }).activities)
      ? (payload as { activities: unknown[] }).activities
      : [];
  const out: WearableSample[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r["activityId"] ?? r["id"] ?? r["externalId"] ?? "").trim();
    const date = asDateKey(r["startTimeGMT"] ?? r["startTimeLocal"] ?? r["date"]);
    if (!id || !date) continue;
    const steps = num(r["steps"]);
    if (steps != null && steps > 0) {
      out.push({ provider: "garmin", externalId: `${id}:steps`, date, kind: "steps", value: Math.round(steps) });
    }
    const type = String(r["activityType"] ?? r["type"] ?? "");
    const typeName =
      typeof r["activityType"] === "object" && r["activityType"]
        ? String((r["activityType"] as { typeKey?: string }).typeKey ?? "")
        : type;
    const kind = garminKind(typeName || type);
    if (kind === "football") {
      out.push({ provider: "garmin", externalId: id, date, kind: "football", value: 1 });
      continue;
    }
    const meters = num(r["distance"]);
    if (kind === "run_km" && meters != null && meters > 0) {
      out.push({
        provider: "garmin",
        externalId: id,
        date,
        kind: "run_km",
        value: Math.round((meters / 1000) * 100) / 100,
      });
    }
  }
  return out;
}

/** Health dump rows `{ id, date, kind, value }` — always pending on web. */
export function normalizeHealthDump(provider: "apple_health" | "health_connect", payload: unknown): WearableSample[] {
  const list = Array.isArray(payload) ? payload : [];
  const out: WearableSample[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r["id"] ?? r["externalId"] ?? "").trim();
    const date = asDateKey(r["date"] ?? r["startDate"]);
    const kindRaw = String(r["kind"] ?? r["type"] ?? "");
    const kind: ActivityLogKind | null =
      kindRaw === "steps" || kindRaw === "football" || kindRaw === "run_km" ? kindRaw : null;
    const value = num(r["value"]);
    if (!id || !date || !kind || value == null || value <= 0) continue;
    out.push({ provider, externalId: id, date, kind, value });
  }
  return out;
}

export function samplesToActivityLogs(samples: WearableSample[], via: IngestVia): ActivityLogEntry[] {
  return samples.map((s) => {
    const status = proofStatusForProvider(s.provider, via);
    const source = PROVIDER_SOURCE[s.provider];
    const entry: ActivityLogEntry = {
      id: `${source}:${s.externalId}`,
      date: s.date,
      kind: s.kind,
      value: s.value,
      source,
      status,
      externalId: s.externalId,
    };
    return entry;
  });
}

export function activityLogDedupeKey(entry: ActivityLogEntry): string {
  if (entry.externalId) return `${entry.source}:${entry.externalId}`;
  return entry.id;
}

export function mergeActivityLogs(existing: ActivityLogEntry[], incoming: ActivityLogEntry[]): ActivityLogEntry[] {
  const map = new Map<string, ActivityLogEntry>();
  for (const e of existing) map.set(activityLogDedupeKey(e), e);
  for (const e of incoming) map.set(activityLogDedupeKey(e), e);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
