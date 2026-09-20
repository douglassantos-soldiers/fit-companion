import { createServerFn } from "@tanstack/react-start";
import type { TrackUserEventInput } from "@/lib/events/types";
import { normalizeEventType, resolveMetadata } from "@/lib/events/normalize";

function parseTrack(input: unknown): {
  deviceId: string;
  eventType: string;
  source?: string;
  metadata?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  occurredAt?: string;
  idempotencyKey?: string;
} {
  const v = input as TrackUserEventInput & { kind?: string } | null;
  const rawType = String(v?.eventType ?? (v as { kind?: string } | null)?.kind ?? "").trim();
  if (!rawType) throw new Error("eventType obrigatório");
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId obrigatório");

  const metadata = resolveMetadata({
    metadata: v?.metadata,
    payload: v?.payload,
  });

  return {
    deviceId,
    eventType: normalizeEventType(rawType),
    source: v?.source ?? "app",
    metadata,
    ...(v?.entityType ? { entityType: String(v.entityType) } : {}),
    ...(v?.entityId ? { entityId: String(v.entityId) } : {}),
    ...(v?.occurredAt ? { occurredAt: v.occurredAt } : {}),
    ...(v?.idempotencyKey ? { idempotencyKey: v.idempotencyKey } : {}),
  };
}

/** Trusted ingest: never trusts client userId; resolves via session/device. */
export const trackAppUserEvent = createServerFn({ method: "POST" })
  .inputValidator(parseTrack)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
    const { trackUserEvent } = await import("@/lib/events/track");
    return trackUserEvent({
      deviceId: data.deviceId,
      resolvedUserId: identity?.userId ?? null,
      eventType: data.eventType,
      ...(data.source ? { source: data.source } : {}),
      ...(data.metadata ? { metadata: data.metadata } : {}),
      ...(data.entityType ? { entityType: data.entityType } : {}),
      ...(data.entityId ? { entityId: data.entityId } : {}),
      ...(data.occurredAt ? { occurredAt: data.occurredAt } : {}),
      ...(data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : {}),
    });
  });
