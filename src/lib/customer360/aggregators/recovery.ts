import { computeRecoveryV2 } from "@/lib/engine/recovery-v2";
import { recentDayCheckIns } from "@/lib/sync/day-checkin";
import type { AppState } from "@/lib/types";
import type { Recovery360 } from "@/lib/customer360/types";

export function aggregateRecovery(state: AppState, hardStreak: number): Recovery360 {
  const v2 = computeRecoveryV2(state);
  const sleepEntries = recentDayCheckIns(state.dayCheckIns, 7);
  const sleepAvg = sleepEntries.length
    ? sleepEntries.reduce((s, c) => s + c.sleepHours, 0) / sleepEntries.length
    : v2.signals.manual.sleepDuration;

  const fatigueSignal =
    hardStreak >= 2 ||
    v2.level === "low" ||
    (sleepAvg != null && sleepAvg < 6);

  return {
    recoveryScore: v2.score,
    sleepAvg7d: sleepAvg != null ? Math.round(sleepAvg * 10) / 10 : null,
    fatigueSignal,
    level: v2.level,
    explanation: v2.explanation,
    manualOnly: true,
    confidence: v2.confidence,
  };
}
