/**
 * Day check-in mapping between AppState and day_checkins table.
 */
import type { DayCheckIn, DayEnergy } from "@/lib/types";

export function dayCheckInToRow(
  checkIn: DayCheckIn,
  channel: { user_id: string; device_id: string },
  version: number,
): Record<string, unknown> {
  return {
    ...channel,
    date: checkIn.date.slice(0, 10),
    sleep: checkIn.sleepHours,
    energy: checkIn.energy,
    soreness: checkIn.soreness ?? null,
    stress: checkIn.stress ?? null,
    available_time: checkIn.availableMin,
    equipment: checkIn.noEquipment ? "none" : null,
    notes: checkIn.notes ? String(checkIn.notes).slice(0, 280) : null,
    version,
    updated_at: new Date().toISOString(),
  };
}

export function rowToDayCheckIn(row: Record<string, unknown>): DayCheckIn {
  const energyRaw = String(row["energy"] ?? "ok");
  const energy: DayEnergy =
    energyRaw === "baixa" || energyRaw === "alta" || energyRaw === "ok" ? energyRaw : "ok";
  const equipment = row["equipment"];
  const checkIn: DayCheckIn = {
    date: String(row["date"] ?? "").slice(0, 10),
    sleepHours: Number(row["sleep"] ?? 7),
    energy,
    availableMin: Number(row["available_time"] ?? 60),
    version: Number(row["version"] ?? 1),
  };
  if (equipment === "none" || equipment === false) checkIn.noEquipment = true;
  const soreness = Number(row["soreness"]);
  if (Number.isFinite(soreness) && soreness >= 1) checkIn.soreness = Math.min(5, Math.round(soreness));
  const stress = Number(row["stress"]);
  if (Number.isFinite(stress) && stress >= 1) checkIn.stress = Math.min(5, Math.round(stress));
  if (typeof row["notes"] === "string" && row["notes"]) checkIn.notes = String(row["notes"]).slice(0, 280);
  return checkIn;
}

/** Merge table rows over retention blob (table wins on same date). */
export function mergeDayCheckIns(
  fromRetention: Record<string, DayCheckIn>,
  fromTable: DayCheckIn[],
): Record<string, DayCheckIn> {
  const out: Record<string, DayCheckIn> = { ...fromRetention };
  for (const c of fromTable) {
    if (!c.date) continue;
    const prev = out[c.date];
    if (!prev || (c.version ?? 1) >= (prev.version ?? 1)) {
      out[c.date] = c;
    }
  }
  return out;
}

/** Recent check-ins sorted by date desc (for Learning / C360). */
export function recentDayCheckIns(
  map: Record<string, DayCheckIn> | undefined,
  limit = 7,
): DayCheckIn[] {
  return Object.values(map ?? {})
    .filter((c) => c.sleepHours > 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit);
}
