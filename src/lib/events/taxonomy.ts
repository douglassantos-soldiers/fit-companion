/**
 * Minimal consistent event taxonomy for product intelligence loops.
 * Prefer these names in new call sites; legacy aliases still normalize via events/normalize.
 */

export const EVENT_TAXONOMY = {
  SESSION_STARTED: "session_started",
  PROFILE_UPDATED: "profile_updated",
  DAY_CHECKIN_COMPLETED: "day_checkin_completed",
  WORKOUT_STARTED: "workout_started",
  WORKOUT_COMPLETED: "workout_completed",
  WORKOUT_RPE_LOGGED: "workout_rpe_logged",
  MEAL_LOGGED: "meal_logged",
  WATER_LOGGED: "water_logged",
  SUPPLEMENT_LOGGED: "supplement_logged",
  SLEEP_LOGGED: "sleep_logged",
  COACH_REQUESTED: "coach_requested",
  RECOMMENDATION_CREATED: "recommendation_created",
  RECOMMENDATION_ACCEPTED: "recommendation_accepted",
  RECOMMENDATION_REJECTED: "recommendation_rejected",
  RECOMMENDATION_SKIPPED: "recommendation_skipped",
  PLAN_CREATED: "plan_created",
  PLAN_COMPLETED: "plan_completed",
  CHALLENGE_COMPLETED: "challenge_completed",
  PURCHASE_SYNCED: "purchase_synced",
  ORDER_SYNCED: "order_synced",
  CUSTOMER360_RECOMPUTED: "customer360_recomputed",
  SAFETY_EVALUATED: "safety_evaluated",
  LEARNING_UPDATED: "learning_updated",
  APP_OPENED: "app_opened",
  USER_CREATED: "user_created",
  ACCESS_GRANTED: "access_granted",
  ACCESS_DENIED: "access_denied",
  MEASUREMENTS_LOGGED: "measurements_logged",
  PROGRESS_PHOTO_UPLOADED: "progress_photo_uploaded",
} as const;

export type EventTaxonomyKey = keyof typeof EVENT_TAXONOMY;
export type EventTaxonomyValue = (typeof EVENT_TAXONOMY)[EventTaxonomyKey];
