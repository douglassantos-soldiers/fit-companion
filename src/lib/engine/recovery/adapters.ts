/**
 * Compatibility adapters: RecoverySnapshot → Recovery v2 / context recovery slice.
 */
import type { ReasonCode } from "@/lib/engine/reason-codes";
import { todayKey, type AppState, type DayEnergy } from "@/lib/types";
import {
  computeRecoverySnapshot,
  type ComputeRecoverySnapshotOpts,
} from "@/lib/engine/recovery/snapshot";
import type { ReadinessLevel, RecoveryLevel, RecoverySnapshot } from "@/lib/engine/recovery/types";

export type RecoveryManualSignals = {
  sleepDuration: number | null;
  sleepConsistency: number | null;
  energy: DayEnergy | null;
  soreness: number | null;
  stress: number | null;
  rpeLoad: number;
  recentTrainingLoad: number;
  trainingFrequency: number;
  muscleFreshnessAvg: number | null;
};

export type RecoveryWearableSignals = {
  restingHr: number | null;
  hrv: number | null;
  source: null;
};

export type RecoverySignals = {
  manual: RecoveryManualSignals;
  wearable: RecoveryWearableSignals;
};

export type RecoveryV2 = {
  level: RecoveryLevel;
  score: number;
  explanation: string;
  reasonCodes: ReasonCode[];
  signals: RecoverySignals;
  confidence: number;
  manualOnly: true | boolean;
  readiness: ReadinessLevel;
};

export function snapshotToRecoveryV2(snap: RecoverySnapshot): RecoveryV2 {
  return {
    level: snap.level,
    score: snap.score ?? 72,
    explanation: snap.explanation,
    reasonCodes: snap.reasonCodes,
    signals: {
      manual: {
        sleepDuration: snap.sleep,
        sleepConsistency: null,
        energy: snap.energy,
        soreness: snap.soreness,
        stress: snap.stress,
        rpeLoad: snap.hardRpeStreak,
        recentTrainingLoad: snap.trainingLoad,
        trainingFrequency: snap.sourceSummary.sessions,
        muscleFreshnessAvg: snap.muscleLoad.avgFreshness,
      },
      wearable: {
        restingHr: snap.wearable.restingHr,
        hrv: snap.wearable.hrv,
        source: null,
      },
    },
    confidence: snap.confidence,
    manualOnly: snap.wearableConfidence === 0,
    readiness: snap.readiness,
  };
}

export function computeRecoveryV2(
  state: AppState,
  date = todayKey(),
  opts?: ComputeRecoverySnapshotOpts,
): RecoveryV2 {
  return snapshotToRecoveryV2(computeRecoverySnapshot(state, date, opts));
}

export function snapshotToContextRecovery(snap: RecoverySnapshot): {
  score: number | null;
  level: RecoveryLevel | null;
  readiness: ReadinessLevel;
  fatigueSignal: boolean;
  sorenessAvg: number | null;
  stressAvg: number | null;
  explanation: string | null;
  confidence: number;
  sleepConfidence: number;
  checkInConfidence: number;
  wearableConfidence: number;
} {
  return {
    score: snap.score,
    level: snap.level,
    readiness: snap.readiness,
    fatigueSignal: snap.fatigueSignal,
    sorenessAvg: snap.soreness,
    stressAvg: snap.stress,
    explanation: snap.explanation,
    confidence: snap.confidence,
    sleepConfidence: snap.sleepConfidence,
    checkInConfidence: snap.checkInConfidence,
    wearableConfidence: snap.wearableConfidence,
  };
}
