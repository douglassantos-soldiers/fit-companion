/**
 * Centralized user event tracking.
 * Prefer this over ad-hoc engagement_events inserts.
 *
 * Identity rule: never trust client-supplied userId for ownership.
 * Callers must pass resolvedUserId from server identity resolution,
 * or deviceId so we resolve via device mapping.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { normalizeEventType, resolveMetadata } from "@/lib/events/normalize";
import type { TrackUserEventInput, UserEventType } from "@/lib/events/types";

export type { TrackUserEventInput, UserEventType } from "@/lib/events/types";
export type { UserEventRecord, EmitUserEventInput, CanonicalEventType } from "@/lib/events/types";
export { EVENT_TAXONOMY } from "@/lib/events/taxonomy";

export type TrackUserEventResult = {
  ok: boolean;
  userId?: string | null;
  error?: string;
};

/**
 * Server-side track into user_events (+ legacy engagement_events when device present).
 * `input.userId` is treated as a legacy claim only — ignored for ownership unless
 * `resolvedUserId` is provided by a trusted server caller.
 */
export async function trackUserEvent(
  input: TrackUserEventInput & { resolvedUserId?: string | null },
): Promise<TrackUserEventResult> {
  try {
    const db = await adminDbLoose();
    if (!db) return { ok: false, error: "db_unavailable" };

    // Legacy client claim — never use for ownership
    if (input.userId && !input.resolvedUserId && process.env["NODE_ENV"] !== "production") {
      console.warn("[trackUserEvent] legacy_userId_ignored", {
        claimed: String(input.userId).slice(0, 8),
      });
    }

    let userId: string | null = input.resolvedUserId ?? null;
    if (!userId && input.deviceId) {
      const { getUserIdForDevice } = await import("@/lib/identity");
      userId = await getUserIdForDevice(input.deviceId);
    }

    const eventType = normalizeEventType(String(input.eventType ?? ""));
    if (!eventType) return { ok: false, error: "invalid_event_type" };

    const metadata = resolveMetadata(input);
    const occurredAt = input.occurredAt ?? new Date().toISOString();

    const row: Record<string, unknown> = {
      user_id: userId,
      device_id: input.deviceId ?? null,
      event_type: eventType,
      source: input.source ?? "app",
      payload: metadata,
      metadata,
      occurred_at: occurredAt,
    };
    if (input.entityType) row["entity_type"] = input.entityType;
    if (input.entityId) row["entity_id"] = input.entityId;
    if (input.idempotencyKey) row["idempotency_key"] = input.idempotencyKey;

    const { error } = await db.from("user_events").insert(row);

    if (error) {
      if (String(error.message ?? "").includes("duplicate") || error.code === "23505") {
        return { ok: true, userId };
      }
      console.warn("user_events insert failed", error.code ?? error.message);
      return { ok: false, userId, error: String(error.code ?? "insert_failed") };
    }

    if (input.deviceId) {
      const { error: engErr } = await db.from("engagement_events").insert({
        device_id: input.deviceId,
        user_id: userId,
        name: eventType,
        props: metadata,
      });
      if (engErr && process.env["NODE_ENV"] !== "production") {
        console.warn("engagement_events insert failed (non-critical)", engErr.code);
      }
    }

    return { ok: true, userId };
  } catch (e) {
    console.warn("trackUserEvent failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "exception" };
  }
}
