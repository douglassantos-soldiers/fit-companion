/**
 * Server fns for sync — client must not write domain tables with anon key.
 */
import { createServerFn } from "@tanstack/react-start";
import type { AppState, DayCheckIn } from "@/lib/types";

function parseDevice(input: unknown) {
  const v = input as { deviceId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { deviceId };
}

function parsePush(input: unknown) {
  const v = input as { deviceId?: string; state?: AppState } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  if (!v?.state || typeof v.state !== "object") throw new Error("state obrigatório");
  return { deviceId, state: v.state };
}

function parseDayCheckIn(input: unknown) {
  const v = input as { deviceId?: string; checkIn?: Record<string, unknown>; version?: number } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const raw = v?.checkIn;
  if (!raw || typeof raw !== "object") throw new Error("checkIn obrigatório");
  const date = String(raw["date"] ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date inválida");
  const energy = String(raw["energy"] ?? "ok");
  const checkIn: DayCheckIn = {
    date,
    sleepHours: Number(raw["sleepHours"] ?? raw["sleep"] ?? 7),
    energy: energy === "baixa" || energy === "alta" ? energy : "ok",
    availableMin: Number(raw["availableMin"] ?? raw["available_time"] ?? 60),
    version: Number(v?.version ?? raw["version"] ?? 1),
  };
  if (raw["noEquipment"] === true || raw["equipment"] === "none") checkIn.noEquipment = true;
  const soreness = Number(raw["soreness"]);
  if (Number.isFinite(soreness) && soreness >= 1) checkIn.soreness = Math.min(5, Math.round(soreness));
  const stress = Number(raw["stress"]);
  if (Number.isFinite(stress) && stress >= 1) checkIn.stress = Math.min(5, Math.round(stress));
  if (typeof raw["notes"] === "string" && raw["notes"]) checkIn.notes = String(raw["notes"]).slice(0, 280);
  return { deviceId, checkIn, version: checkIn.version ?? 1 };
}

export const pullStateFn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { pullStateServer } = await import("@/lib/sync.server");
    return pullStateServer(data.deviceId);
  });

export const pushStateFn = createServerFn({ method: "POST" })
  .inputValidator(parsePush)
  .handler(async ({ data }) => {
    const { pushStateServer } = await import("@/lib/sync.server");
    return pushStateServer(data.deviceId, data.state);
  });

export const clearRemoteStateFn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { clearRemoteStateServer } = await import("@/lib/sync.server");
    return clearRemoteStateServer(data.deviceId);
  });

/** Explicit wipe of internal account domain data (not Shopify external). */
export const clearUserDataFn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { clearUserDataServer } = await import("@/lib/sync.server");
    return clearUserDataServer(data.deviceId);
  });

export const exportUserDataFn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { exportUserDataServer } = await import("@/lib/sync.server");
    return exportUserDataServer(data.deviceId);
  });

/** Granular day_checkin upsert with version conflict detection. */
export const upsertDayCheckInFn = createServerFn({ method: "POST" })
  .inputValidator(parseDayCheckIn)
  .handler(async ({ data }) => {
    const { upsertDayCheckInServer } = await import("@/lib/sync.server");
    return upsertDayCheckInServer(data.deviceId, data.checkIn, data.version);
  });
