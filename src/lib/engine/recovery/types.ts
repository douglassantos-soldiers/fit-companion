/**
 * Recovery Intelligence — types.
 * Not a medical diagnosis. Score, readiness and safety escalation are separate layers.
 */
import type { MuscleGroup } from "@/data/exercises";
import type { ReasonCode } from "@/lib/engine/reason-codes";
import type { DayEnergy } from "@/lib/types";

export const READINESS_LEVELS = ["high", "moderate", "low", "unknown"] as const;
export type ReadinessLevel = (typeof READINESS_LEVELS)[number];

/** Compat with Recovery v2 / C360 / learning guardrails. */
export type RecoveryLevel = "recovered" | "moderate" | "low" | "unknown";

export type SleepSource = "checkin" | "profile" | "wearable" | "none";

export type MuscleRecoveryStatus = "fresh" | "ok" | "fatigued" | "unknown";

export type RecoverySourceSummary = {
  sleep: SleepSource;
  checkIn: boolean;
  wearable: boolean;
  sessions: number;
};

export type WearableRecoveryInput = {
  restingHr: number | null;
  hrv: number | null;
};

export type RecoverySnapshot = {
  date: string;
  score: number | null;
  level: RecoveryLevel;
  readiness: ReadinessLevel;
  sleep: number | null;
  energy: DayEnergy | null;
  soreness: number | null;
  stress: number | null;
  hardRpeStreak: number;
  trainingLoad: number;
  muscleLoad: {
    avgFreshness: number | null;
    highLoadGroups: number;
  };
  fatigueSignal: boolean;
  reasonCodes: ReasonCode[];
  confidence: number;
  sleepConfidence: number;
  checkInConfidence: number;
  wearableConfidence: number;
  sourceSummary: RecoverySourceSummary;
  explanation: string;
  muscles: MuscleRecoveryRow[];
  wearable: WearableRecoveryInput;
};

export type MuscleRecoveryRow = {
  muscle: MuscleGroup;
  label: string;
  freshness: number;
  load7d: number;
  load28d: number;
  estimatedRecovery: number;
  recoveryEstimate: number;
  directLoad7d: number;
  directLoad28d: number;
  effectiveLoad: number;
  fatigueContribution: number;
  status: MuscleRecoveryStatus;
  confidence: number;
  reasonCodes: string[];
  lastTrainedHours: number | null;
};

export function readinessToLevel(readiness: ReadinessLevel): RecoveryLevel {
  if (readiness === "high") return "recovered";
  if (readiness === "unknown") return "unknown";
  return readiness;
}

export function trafficScoreForReadiness(readiness: ReadinessLevel, score: number | null): number {
  if (readiness === "high") return score ?? 80;
  if (readiness === "low") return score ?? 35;
  if (readiness === "unknown") return 55;
  return score ?? 60;
}
