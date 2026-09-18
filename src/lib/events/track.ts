/**
 * Centralized user event tracking.
 * Prefer this over ad-hoc engagement_events inserts.
 */
import { adminDbLoose } from "@/lib/db-admin";

export type UserEventType =
  | "user_created"
  | "onboarding_completed"
  | "workout_started"
  | "workout_completed"
  | "workout_skipped"
  | "meal_logged"
  | "weight_logged"
  | "supplement_taken"
  | "supplement_skipped"
  | "challenge_started"
  | "challenge_completed"
  | "coach_interaction"
  | "product_viewed"
  | "product_clicked"
  | "purchase"
  | "refund"
  | "restock"
  | "goal_changed"
  | "access_granted"
  | "auth_linked"
  | "restock_cta_click"
  | string;

export type TrackUserEventInput = {
  userId?: string | null;
  deviceId?: string | null;
  eventType: UserEventType;
  source?: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
  idempotencyKey?: string;
};

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

    const row: Record<string, unknown> = {
      user_id: userId,
      device_id: input.deviceId ?? null,
      event_type: input.eventType,
      source: input.source ?? "app",
      payload: input.payload ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    };
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
        name: input.eventType,
        props: input.payload ?? {},
      });
    }

    return { ok: true };
  } catch (e) {
    console.warn("trackUserEvent skipped", e);
    return { ok: false };
  }
}
