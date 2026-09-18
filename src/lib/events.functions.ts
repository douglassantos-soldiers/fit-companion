import { createServerFn } from "@tanstack/react-start";
import type { TrackUserEventInput } from "@/lib/events/track";

function parseTrack(input: unknown): {
  deviceId: string;
  eventType: string;
  source?: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
  idempotencyKey?: string;
} {
  const v = input as TrackUserEventInput | null;
  const eventType = String(v?.eventType ?? "").trim();
  if (!eventType) throw new Error("eventType obrigatório");
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId obrigatório");
  // Ignore client userId entirely
  return {
    deviceId,
    eventType,
    source: v?.source ?? "app",
    payload: v?.payload && typeof v.payload === "object" ? v.payload : {},
    ...(v?.occurredAt ? { occurredAt: v.occurredAt } : {}),
    ...(v?.idempotencyKey ? { idempotencyKey: v.idempotencyKey } : {}),
  };
}

export const trackAppUserEvent = createServerFn({ method: "POST" })
  .inputValidator(parseTrack)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId });
    const { trackUserEvent } = await import("@/lib/events/track");
    return trackUserEvent({
      deviceId: data.deviceId,
      userId: identity?.userId ?? null,
      eventType: data.eventType,
      source: data.source,
      payload: data.payload,
      occurredAt: data.occurredAt,
      idempotencyKey: data.idempotencyKey,
    });
  });
