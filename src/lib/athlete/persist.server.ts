/**
 * Persist normalized activities (service_role). Identity from trusted session only.
 */
import type { Activity } from "@/lib/athlete/types";
import { adminDbLoose } from "@/lib/db-admin";

export async function upsertActivities(
  userId: string,
  rows: Activity[],
): Promise<{ upserted: number; skipped: number }> {
  if (!userId || !rows.length) return { upserted: 0, skipped: 0 };
  const db = await adminDbLoose();
  if (!db) {
    console.info("activities_upsert skipped", { reason: "db_unavailable", count: rows.length });
    return { upserted: 0, skipped: rows.length };
  }

  const payload = rows.map((row) => {
    const rec: Record<string, unknown> = {
      id: row.id,
      user_id: userId,
      source: row.source,
      type: row.type,
      started_at: row.startedAt,
      proof_status: row.proofStatus,
      created_at: row.createdAt,
      metrics: row.metrics ?? {},
    };
    if (row.externalId) rec["external_id"] = row.externalId;
    if (row.durationSec != null) rec["duration_sec"] = row.durationSec;
    if (row.distanceM != null) rec["distance_m"] = row.distanceM;
    if (row.calories != null) rec["calories"] = row.calories;
    if (row.device) rec["device"] = row.device;
    return rec;
  });

  const { error, data } = await db
    .from("activities")
    .upsert(payload, { onConflict: "id" })
    .select("id");
  if (error) {
    console.info("activities_upsert failed", { reason: error.message, count: rows.length });
    return { upserted: 0, skipped: rows.length };
  }
  const upserted = data?.length ?? payload.length;
  console.info("activities_upsert ok", { upserted, userPresent: true });
  return { upserted, skipped: 0 };
}

export async function listActivitiesForUser(
  userId: string,
  sinceIso?: string,
): Promise<Activity[]> {
  const db = await adminDbLoose();
  if (!db) return [];
  let q = db
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(200);
  if (sinceIso) q = q.gte("started_at", sinceIso);
  const { data } = await q;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToActivity);
}

function rowToActivity(row: Record<string, unknown>): Activity {
  const metrics =
    row["metrics"] && typeof row["metrics"] === "object"
      ? (row["metrics"] as Activity["metrics"])
      : undefined;
  const rec: Activity = {
    id: String(row["id"] ?? ""),
    userId: String(row["user_id"] ?? ""),
    source: row["source"] as Activity["source"],
    type: row["type"] as Activity["type"],
    startedAt: String(row["started_at"] ?? ""),
    createdAt: String(row["created_at"] ?? row["started_at"] ?? ""),
    proofStatus: (row["proof_status"] as Activity["proofStatus"]) ?? "self_reported",
  };
  const externalId = String(row["external_id"] ?? "").trim();
  if (externalId) rec.externalId = externalId;
  if (row["duration_sec"] != null) rec.durationSec = Number(row["duration_sec"]);
  if (row["distance_m"] != null) rec.distanceM = Number(row["distance_m"]);
  if (row["calories"] != null) rec.calories = Number(row["calories"]);
  const device = String(row["device"] ?? "").trim();
  if (device) rec.device = device;
  if (metrics) rec.metrics = metrics;
  return rec;
}
