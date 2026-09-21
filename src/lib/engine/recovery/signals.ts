/**
 * Shared recovery signals — one hard-RPE streak, confidences, wearable extract.
 */
import type { AppState } from "@/lib/types";
import type { WearableRecoveryInput } from "@/lib/engine/recovery/types";

export function consecutiveHardRpeStreak(sessions: AppState["sessions"] | undefined): number {
  const sorted = [...(sessions ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const s of sorted) {
    if (s.rpe === "dificil") streak += 1;
    else break;
  }
  return streak;
}

export function stddevHours(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

export function extractWearableRecovery(
  _state: AppState,
  override?: WearableRecoveryInput,
): WearableRecoveryInput {
  if (override) {
    return {
      restingHr: override.restingHr,
      hrv: override.hrv,
    };
  }
  return { restingHr: null, hrv: null };
}

export function wearableConfidenceOf(wearable: WearableRecoveryInput): number {
  const hasHrv = wearable.hrv != null;
  const hasHr = wearable.restingHr != null;
  if (hasHrv && hasHr) return 0.7;
  if (hasHrv || hasHr) return 0.55;
  return 0;
}
