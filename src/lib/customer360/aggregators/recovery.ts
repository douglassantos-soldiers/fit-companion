import { performanceDimensions } from "@/lib/engine/dimensions";
import type { AppState } from "@/lib/types";
import type { Recovery360 } from "@/lib/customer360/types";

export function aggregateRecovery(state: AppState, hardStreak: number): Recovery360 {
  const sleepEntries = Object.values(state.dayCheckIns ?? {})
    .filter((c) => c.sleepHours > 0)
    .slice(0, 7);
  const sleepAvg = sleepEntries.length
    ? sleepEntries.reduce((s, c) => s + c.sleepHours, 0) / sleepEntries.length
    : null;

  let recoveryScore: number | null = null;
  if (state.profile) {
    const dims = performanceDimensions(state, state.profile);
    recoveryScore = dims.find((d) => d.key === "recuperacao")?.score ?? null;
  }

  return {
    recoveryScore,
    sleepAvg7d: sleepAvg != null ? Math.round(sleepAvg * 10) / 10 : null,
    fatigueSignal: hardStreak >= 2 || (sleepAvg != null && sleepAvg < 6),
  };
}
