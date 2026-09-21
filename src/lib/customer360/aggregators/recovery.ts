import { computeRecoverySnapshot, type RecoverySnapshot } from "@/lib/engine/recovery";
import { recentDayCheckIns } from "@/lib/sync/day-checkin";
import { todayKey, type AppState } from "@/lib/types";
import type { Recovery360 } from "@/lib/customer360/types";

export function aggregateRecovery(
  state: AppState,
  hardStreak: number,
  date = todayKey(),
  recovery?: RecoverySnapshot,
): Recovery360 {
  const snap = recovery ?? computeRecoverySnapshot(state, date);
  const sleepEntries = recentDayCheckIns(state.dayCheckIns, 7);
  const sleepAvg = sleepEntries.length
    ? sleepEntries.reduce((s, c) => s + c.sleepHours, 0) / sleepEntries.length
    : snap.sleep;

  const fatigueSignal = snap.fatigueSignal || hardStreak >= 2;

  const row: Recovery360 = {
    recoveryScore: snap.score,
    sleepAvg7d: sleepAvg != null ? Math.round(sleepAvg * 10) / 10 : null,
    fatigueSignal,
    level: snap.level === "unknown" ? null : snap.level,
    explanation: snap.explanation,
    manualOnly: snap.wearableConfidence === 0,
    confidence: snap.confidence,
  };
  return row;
}
