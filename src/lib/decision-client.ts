/**
 * Client helper: hydrate authoritative DecisionContext from the server.
 * Never treat client-computed engines as the write path.
 */
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { AppState, SessionLog, SessionRpe } from "@/lib/types";
import { todayKey } from "@/lib/types";
import type { OutcomeMetrics } from "@/lib/engine/outcome-learning";

export async function refreshDecisionContextBestEffort(
  deviceId: string,
  date = todayKey(),
): Promise<DecisionContextSnapshot | null> {
  if (!deviceId || typeof window === "undefined") return null;
  try {
    const { getDecisionContextFn } = await import("@/lib/decision.functions");
    const res = await getDecisionContextFn({ data: { deviceId, date } });
    return res.snapshot ?? null;
  } catch {
    return null;
  }
}

/** Compatibility: formerly computed locally and logged. Now server-assembles. */
export function persistDecisionsBestEffort(
  deviceId: string,
  _state: AppState,
  date = todayKey(),
): void {
  if (!deviceId || typeof window === "undefined") return;
  void refreshDecisionContextBestEffort(deviceId, date).catch(() => undefined);
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

export function recordDecisionActionBestEffort(opts: {
  deviceId: string;
  date?: string;
  actionKind: string;
  status?: string;
  entityType?: string;
  entityId?: string;
  mealSlot?: string;
  primaryKind?: "train" | "rest" | "sleep" | "meal";
  express?: boolean;
}): void {
  if (!opts.deviceId || typeof window === "undefined") return;
  const payload: {
    deviceId: string;
    date: string;
    actionKind: string;
    status?: string;
    entityType?: string;
    entityId?: string;
    mealSlot?: string;
    primaryKind?: "train" | "rest" | "sleep" | "meal";
    express?: boolean;
  } = {
    deviceId: opts.deviceId,
    date: (opts.date ?? todayKey()).slice(0, 10),
    actionKind: opts.actionKind,
  };
  if (opts.status) payload.status = opts.status;
  if (opts.entityType) payload.entityType = opts.entityType;
  if (opts.entityId) payload.entityId = opts.entityId;
  if (opts.mealSlot) payload.mealSlot = opts.mealSlot;
  if (opts.primaryKind) payload.primaryKind = opts.primaryKind;
  if (opts.express != null) payload.express = opts.express;
  void import("@/lib/decision.functions")
    .then(({ recordDecisionActionFn }) => recordDecisionActionFn({ data: payload }))
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
