/**
 * Canonical FASE 3 user event types.
 * event_id in DB is exposed as `id` in the TypeScript contract.
 */

export const CANONICAL_EVENT_TYPES = [
  "workout_started",
  "workout_completed",
  "workout_skipped",
  "workout_modified",
  "meal_logged",
  "meal_updated",
  "meal_deleted",
  "weight_logged",
  "checkin_completed",
  "supplement_taken",
  "supplement_skipped",
  "challenge_joined",
  "challenge_completed",
  "coach_interaction",
  "plan_viewed",
  "plan_modified",
  "product_viewed",
  "product_clicked",
  "restock_shown",
  "restock_clicked",
  "purchase",
  "refund",
] as const;

export type CanonicalEventType = (typeof CANONICAL_EVENT_TYPES)[number];

/** Legacy / learning-loop names still accepted as input (normalized before insert). */
export const LEGACY_EVENT_ALIASES = {
  restock_cta_click: "restock_clicked",
  restock: "restock_clicked",
  challenge_join: "challenge_joined",
  challenge_started: "challenge_joined",
  challenge_complete: "challenge_completed",
  checkin_sleep: "checkin_completed",
} as const;

export type LegacyEventAlias = keyof typeof LEGACY_EVENT_ALIASES;

/** Extra event types kept for identity/commerce/learning (not aliased). */
export const EXTENDED_EVENT_TYPES = [
  "user_created",
  "onboarding_completed",
  "goal_changed",
  "access_granted",
  "auth_linked",
  "living_plan_followed",
  "living_plan_skipped",
  "meal_ai_used",
  "express_chosen",
  "deload_applied",
] as const;

export type ExtendedEventType = (typeof EXTENDED_EVENT_TYPES)[number];

export type UserEventType = CanonicalEventType | ExtendedEventType | string;

export type EventEntityType =
  | "workout"
  | "session"
  | "meal"
  | "weight"
  | "day_checkin"
  | "supplement"
  | "challenge"
  | "plan"
  | "product"
  | "order"
  | "coach"
  | string;

/** Canonical event row shape (API). Maps DB `event_id` → `id`, `payload` mirrored in `metadata`. */
export type UserEventRecord = {
  id: string;
  userId: string | null;
  deviceId?: string | null;
  eventType: UserEventType;
  occurredAt: string;
  source: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type TrackUserEventInput = {
  userId?: string | null;
  deviceId?: string | null;
  eventType: UserEventType;
  source?: string;
  /** Preferred FASE 3 field */
  metadata?: Record<string, unknown>;
  /** Legacy alias for metadata */
  payload?: Record<string, unknown>;
  entityType?: string | null;
  entityId?: string | null;
  occurredAt?: string;
  idempotencyKey?: string;
};

export type EmitUserEventInput = {
  type: UserEventType;
  entityType?: EventEntityType | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  idempotencyKey?: string;
  source?: string;
};
