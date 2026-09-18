/**
 * Client helper: persist Decision Engine output best-effort.
 */
import { buildContextSnapshot } from "@/lib/engine/context-snapshot";
import { buildLivingPlanWithDecisions } from "@/lib/engine/living-plan";
import type { AppState, SessionLog, SessionRpe } from "@/lib/types";
import { todayKey } from "@/lib/types";
import type { OutcomeMetrics } from "@/lib/engine/outcome-learning";

export function persistDecisionsBestEffort(deviceId: string, state: AppState, date = todayKey()): void {
  if (!deviceId || typeof window === "undefined") return;
  try {
    const built = buildLivingPlanWithDecisions(state, date);
    const snapshot = buildContextSnapshot(state, date, state.userId);
    if (!built || !snapshot) return;
    void import("@/lib/decision.functions")
      .then(({ logDecisionsFn }) =>
        logDecisionsFn({
          data: {
            deviceId,
            date,
            decisions: built.decisions.decisions,
            snapshot,
          },
        }),
      )
      .catch(() => undefined);
  } catch {
    /* best-effort */
  }
}

export function markDecisionOutcomeBestEffort(
  deviceId: string,
  outcome: string,
  date = todayKey(),
  outcomeMetrics?: OutcomeMetrics | null,
): void {
  if (!deviceId || typeof window === "undefined") return;
  void import("@/lib/decision.functions")
    .then(({ markDecisionOutcomeFn }) =>
      markDecisionOutcomeFn({
        data: { deviceId, date, outcome, outcomeMetrics: outcomeMetrics ?? null },
      }),
    )
    .catch(() => undefined);
}

export function recordSessionOutcomeBestEffort(
  deviceId: string,
  session: Pick<SessionLog, "date" | "durationMin" | "rpe" | "express">,
  volumeFactor?: number | null,
): void {
  if (!deviceId || typeof window === "undefined") return;
  const date = session.date.slice(0, 10);
  void import("@/lib/decision.functions")
    .then(({ recordSessionOutcomeFn }) =>
      recordSessionOutcomeFn({
        data: {
          deviceId,
          date,
          rpe: (session.rpe ?? null) as SessionRpe | null,
          durationMin: session.durationMin,
          volumeFactor: volumeFactor ?? null,
          express: Boolean(session.express),
        },
      }),
    )
    .catch(() => undefined);
}

function yesterdayKey(from = todayKey()): string {
  const d = new Date(`${from}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** After check-in, attach D+1 energy/sleep to yesterday's reduced-volume decisions. */
export function recordNextDayCheckInBestEffort(
  deviceId: string,
  checkIn: { date: string; energy: import("@/lib/types").DayEnergy; sleepHours: number },
): void {
  if (!deviceId || typeof window === "undefined") return;
  const today = checkIn.date.slice(0, 10);
  // Only when checking in "today" do we close yesterday's loop
  if (today !== todayKey()) return;
  const yesterday = yesterdayKey(today);
  void import("@/lib/decision.functions")
    .then(({ recordNextDayCheckInOutcomeFn }) =>
      recordNextDayCheckInOutcomeFn({
        data: {
          deviceId,
          yesterday,
          energy: checkIn.energy,
          sleepHours: checkIn.sleepHours,
        },
      }),
    )
    .catch(() => undefined);
}
