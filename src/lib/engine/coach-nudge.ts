/**
 * Proactive Coach overlay detector (Fase 16). Rule-based, no LLM.
 * Fires when week-over-week volume is up ≥15% and recovery worsened.
 */
import { trafficForScore, weekOverWeek, type TrafficLight } from "@/lib/engine/dimensions";
import { todayKey, type AppState } from "@/lib/types";

const TRAFFIC_RANK: Record<TrafficLight, number> = { green: 2, yellow: 1, red: 0 };

export type CoachNudgeInput = {
  volumeDeltaPct: number | null;
  recoveryNow: TrafficLight | null;
  recoveryPrev: TrafficLight | null;
  dismissedAt?: string | null;
  shownAt?: string | null;
  now?: Date;
};

export type CoachNudgeResult = {
  show: boolean;
  volumeDeltaPct: number | null;
  recoveryNow: TrafficLight | null;
  recoveryPrev: TrafficLight | null;
};

function sameCalendarDay(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return todayKey(d) === todayKey(now);
}

export function recoveryWorsened(now: TrafficLight | null, prev: TrafficLight | null): boolean {
  if (!now || !prev) return false;
  return TRAFFIC_RANK[now] < TRAFFIC_RANK[prev];
}

export function evaluateCoachNudge(input: CoachNudgeInput): CoachNudgeResult {
  const now = input.now ?? new Date();
  const volumeOk = (input.volumeDeltaPct ?? 0) >= 15;
  const recOk = recoveryWorsened(input.recoveryNow, input.recoveryPrev);
  const capped = sameCalendarDay(input.dismissedAt, now) || sameCalendarDay(input.shownAt, now);
  return {
    show: volumeOk && recOk && !capped,
    volumeDeltaPct: input.volumeDeltaPct,
    recoveryNow: input.recoveryNow,
    recoveryPrev: input.recoveryPrev,
  };
}

function shiftDateKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

export function coachNudgeFromState(state: AppState, now = new Date()): CoachNudgeResult {
  const wow = weekOverWeek(state.sessions);
  const today = todayKey(now);
  const livingNow = state.livingPlans?.[today]?.traffic.recovery ?? null;
  const livingPrev = state.livingPlans?.[shiftDateKey(today, -7)]?.traffic.recovery ?? null;

  let recoveryNow = livingNow;
  let recoveryPrev = livingPrev;
  if (!recoveryNow || !recoveryPrev) {
    const snaps = [...(state.dimensionSnapshots ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    const latest = snaps[snaps.length - 1];
    const weekAgo = snaps.find((s) => s.date <= shiftDateKey(today, -7)) ?? snaps[0];
    if (!recoveryNow && latest?.scores?.recuperacao != null) {
      recoveryNow = trafficForScore(latest.scores.recuperacao);
    }
    if (!recoveryPrev && weekAgo?.scores?.recuperacao != null) {
      recoveryPrev = trafficForScore(weekAgo.scores.recuperacao);
    }
  }

  return evaluateCoachNudge({
    volumeDeltaPct: wow.volumeDeltaPct,
    recoveryNow,
    recoveryPrev,
    dismissedAt: state.coachNudgeDismissedAt,
    shownAt: state.coachNudgeShownAt,
    now,
  });
}
