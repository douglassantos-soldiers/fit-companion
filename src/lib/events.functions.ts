import { createServerFn } from "@tanstack/react-start";
import type { TrackUserEventInput } from "@/lib/events/track";

function parseTrack(input: unknown): TrackUserEventInput {
  const v = input as TrackUserEventInput | null;
  const eventType = String(v?.eventType ?? "").trim();
  if (!eventType) throw new Error("eventType obrigatório");
  const out: TrackUserEventInput = {
    eventType,
    source: v?.source ?? "app",
    payload: v?.payload && typeof v.payload === "object" ? v.payload : {},
  };
  if (v?.userId != null) out.userId = v.userId;
  if (v?.deviceId != null) out.deviceId = v.deviceId;
  if (v?.occurredAt) out.occurredAt = v.occurredAt;
  if (v?.idempotencyKey) out.idempotencyKey = v.idempotencyKey;
  return out;
}

export const trackAppUserEvent = createServerFn({ method: "POST" })
  .inputValidator(parseTrack)
  .handler(async ({ data }) => {
    const { trackUserEvent } = await import("@/lib/events/track");
    return trackUserEvent(data);
  });
