/**
 * Outcome / action tracking for the learning loop.
 * Thin helpers over emitUserEvent / trackAppEvent so callers don't invent event names.
 */
import { emitUserEvent } from "@/lib/events/emit";
import { trackAppEvent } from "@/lib/shopify.functions";
import { markDecisionOutcomeBestEffort } from "@/lib/decision-client";
import { todayKey } from "@/lib/types";
import { recordBehaviorOutcomeBestEffort } from "@/lib/engine/outcome-learning";

export type OutcomeKind =
  | "workout_started"
  | "workout_skipped"
  | "supplement_skipped"
  | "challenge_started"
  | "challenge_joined"
  | "challenge_completed"
  | "coach_interaction"
  | "product_viewed"
  | "product_clicked"
  | "goal_changed"
  | "living_plan_followed"
  | "living_plan_skipped"
  | "meal_ai_used"
  | "checkin_sleep"
  | "checkin_completed"
  | "express_chosen"
  | "deload_applied"
  | "plan_viewed"
  | "plan_modified";

export async function trackOutcome(
  deviceId: string,
  kind: OutcomeKind,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!deviceId) return;
  try {
    if (typeof window !== "undefined") {
      emitUserEvent({
        type: kind,
        metadata: payload,
        entityType: typeof payload["entityType"] === "string" ? payload["entityType"] : undefined,
        entityId:
          typeof payload["entityId"] === "string"
            ? payload["entityId"]
            : typeof payload["challengeId"] === "string"
              ? payload["challengeId"]
              : typeof payload["dayId"] === "string"
                ? payload["dayId"]
                : undefined,
      });
      if (kind === "living_plan_followed" || kind === "living_plan_skipped") {
        markDecisionOutcomeBestEffort(deviceId, kind, todayKey());
      }
      return;
    }
    await trackAppEvent({ data: { deviceId, kind, payload } });
  } catch {
    /* best-effort */
  }
}

/** After express/workout/meal completion tied to a behavior intervention. */
export async function trackBehaviorInterventionOutcome(opts: {
  userId?: string | null;
  interventionId?: string | null;
  success: boolean;
  kind?: "express" | "workout" | "meal";
  metrics?: Record<string, unknown>;
}): Promise<void> {
  const payload: {
    userId?: string | null;
    interventionId?: string | null;
    success: boolean;
    metrics: Record<string, unknown>;
  } = {
    success: opts.success,
    metrics: {
      kind: opts.kind ?? "workout",
      ...(opts.metrics ?? {}),
    },
  };
  if (opts.userId !== undefined) payload.userId = opts.userId;
  if (opts.interventionId !== undefined) payload.interventionId = opts.interventionId;
  await recordBehaviorOutcomeBestEffort(payload);
}
