/**
 * Surface telemetry for the Today (/) page — impressions and clicks by block.
 */
import { emitAppEventCompat } from "@/lib/events/emit";
import { getDeviceId } from "@/lib/sync";
import { todayKey } from "@/lib/types";

export type HomeSurfaceKind =
  | "home_block_impression"
  | "home_block_click"
  | "mais_aberto"
  | "checkin_opened"
  | "coach_teaser_click";

const impressed = new Set<string>();

export function trackHomeSurface(
  kind: HomeSurfaceKind,
  payload: Record<string, unknown> = {},
): void {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  if (kind === "home_block_impression") {
    const blockId = String(payload["blockId"] ?? "");
    const key = `${todayKey()}:${blockId}`;
    if (!blockId || impressed.has(key)) return;
    impressed.add(key);
  }
  emitAppEventCompat(deviceId, kind, { date: todayKey(), ...payload }, {
    entityType: "home",
    entityId: typeof payload["blockId"] === "string" ? payload["blockId"] : todayKey(),
    idempotencyKey:
      kind === "home_block_impression"
        ? `home_imp:${todayKey()}:${String(payload["blockId"] ?? "")}`
        : undefined,
  });
}
