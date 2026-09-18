/**
 * Centralized user event tracking.
 * Prefer this over ad-hoc engagement_events inserts.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { normalizeEventType, resolveMetadata } from "@/lib/events/normalize";
import type { TrackUserEventInput, UserEventType } from "@/lib/events/types";

export type { TrackUserEventInput, UserEventType } from "@/lib/events/types";
export type { UserEventRecord, EmitUserEventInput, CanonicalEventType } from "@/lib/events/types";

/** Server-side track into user_events (+ legacy engagement_events when device present). */
export async function trackUserEvent(input: TrackUserEventInput): Promise<{ ok: boolean }> {
  try {
    const db = await adminDbLoose();
    if (!db) return { ok: false };

    let userId = input.userId ?? null;
    if (!userId && input.deviceId) {
      const { getUserIdForDevice } = await import("@/lib/identity");
      userId = await getUserIdForDevice(input.deviceId);
    }

    const eventType = normalizeEventType(String(input.eventType ?? ""));
    if (!eventType) return { ok: false };

    const metadata = resolveMetadata(input);

    const row: Record<string, unknown> = {
      user_id: userId,
      device_id: input.deviceId ?? null,
      event_type: eventType,
      source: input.source ?? "app",
      payload: metadata,
      metadata,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    };
    if (input.entityType) row["entity_type"] = input.entityType;
    if (input.entityId) row["entity_id"] = input.entityId;
    if (input.idempotencyKey) row["idempotency_key"] = input.idempotencyKey;

    const { error } = await db.from("user_events").insert(row);

    if (error) {
      if (String(error.message ?? "").includes("duplicate") || error.code === "23505") {
        return { ok: true };
      }
      console.warn("user_events insert failed", error);
      return { ok: false };
    }

    if (input.deviceId) {
      await db.from("engagement_events").insert({
        device_id: input.deviceId,
        user_id: userId,
        name: eventType,
        props: metadata,
      });
    }

    return { ok: true };
  } catch (e) {
    console.warn("trackUserEvent skipped", e);
    return { ok: false };
  }
}
