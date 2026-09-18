/**
 * Outcome / action tracking for the learning loop.
 * Thin helpers over trackAppEvent so callers don't invent event names.
 */
import { trackAppEvent } from "@/lib/shopify.functions";

export type OutcomeKind =
  | "workout_started"
  | "workout_skipped"
  | "supplement_skipped"
  | "challenge_started"
  | "challenge_completed"
  | "coach_interaction"
  | "product_viewed"
  | "product_clicked"
  | "goal_changed"
  | "living_plan_followed"
  | "living_plan_skipped"
  | "meal_ai_used"
  | "checkin_sleep"
  | "express_chosen"
  | "deload_applied";

export async function trackOutcome(
  deviceId: string,
  kind: OutcomeKind,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!deviceId) return;
  try {
    await trackAppEvent({ data: { deviceId, kind, payload } });
  } catch {
    /* best-effort */
  }
}
