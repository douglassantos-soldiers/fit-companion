/**
 * Recovery Engine v2 — readiness from manual signals only (FASE 5).
 * Never invents wearable/HRV/RHR data when not connected.
 */
import { sessionsInLastDays } from "@/lib/engine/dimensions";
import { muscleRecoveryMap } from "@/lib/engine/recovery";
import type { ReasonCode } from "@/lib/engine/reason-codes";
import { recentDayCheckIns } from "@/lib/sync/day-checkin";
import { todayKey, type AppState, type DayEnergy } from "@/lib/types";

export type RecoveryLevel = "recovered" | "moderate" | "low";

export type RecoveryManualSignals = {
  sleepDuration: number | null;
  sleepConsistency: number | null; // lower = more consistent (stddev hours)
  energy: DayEnergy | null;
  soreness: number | null;
  stress: number | null;
  rpeLoad: number; // hard streak
  recentTrainingLoad: number; // sessions in 3d
  trainingFrequency: number; // sessions in 7d
  muscleFreshnessAvg: number | null; // 0–100
};

export type RecoveryWearableSignals = {
  restingHr: number | null;
  hrv: number | null;
  /** Always null until a wearable is connected */
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
  manualOnly: true;
};

function stddev(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

function hardRpeStreak(sessions: AppState["sessions"]): number {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const s of sorted) {
    if (s.rpe === "dificil") streak += 1;
    else break;
  }
  return streak;
}

export function computeRecoveryV2(state: AppState, date = todayKey()): RecoveryV2 {
  const checkIn = state.dayCheckIns?.[date];
  const recent = recentDayCheckIns(state.dayCheckIns, 7);
  const sleepValues = recent.map((c) => c.sleepHours).filter((h) => h > 0);
  const sleepDuration =
    checkIn?.sleepHours ??
    (sleepValues.length ? sleepValues[0]! : state.profile?.typicalSleepHours ?? null);
  const sleepConsistency = stddev(sleepValues);

  const sorenessVals = recent
    .map((c) => c.soreness)
    .filter((n): n is number => typeof n === "number");
  const stressVals = recent
    .map((c) => c.stress)
    .filter((n): n is number => typeof n === "number");
  const soreness =
    checkIn?.soreness ??
    (sorenessVals.length
      ? sorenessVals.reduce((a, b) => a + b, 0) / sorenessVals.length
      : null);
  const stress =
    checkIn?.stress ??
    (stressVals.length ? stressVals.reduce((a, b) => a + b, 0) / stressVals.length : null);

  const rpeLoad = hardRpeStreak(state.sessions);
  const trainingFrequency = sessionsInLastDays(state.sessions, 7).length;
  const cutoff3 = (() => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  })();
  const recentTrainingLoad = state.sessions.filter((s) => s.date.slice(0, 10) >= cutoff3).length;

  const muscles = muscleRecoveryMap(state.sessions);
  const muscleFreshnessAvg = muscles.length
    ? Math.round(muscles.reduce((s, m) => s + m.freshness, 0) / muscles.length)
    : null;

  const energy = checkIn?.energy ?? null;

  const manual: RecoveryManualSignals = {
    sleepDuration,
    sleepConsistency,
    energy,
    soreness: soreness != null ? Math.round(soreness * 10) / 10 : null,
    stress: stress != null ? Math.round(stress * 10) / 10 : null,
    rpeLoad,
    recentTrainingLoad,
    trainingFrequency,
    muscleFreshnessAvg,
  };

  const wearable: RecoveryWearableSignals = {
    restingHr: null,
    hrv: null,
    source: null,
  };

  // Score 0–100 from manual signals only
  let score = 72;
  const reasonCodes: ReasonCode[] = [];

  if (sleepDuration != null) {
    if (sleepDuration < 6) {
      score -= 22;
      reasonCodes.push("sleep_low");
    } else if (sleepDuration < 7) {
      score -= 8;
    } else {
      score += 4;
      reasonCodes.push("sleep_good");
    }
  } else {
    score -= 6;
  }

  if (sleepConsistency != null && sleepConsistency > 1.2) {
    score -= 8;
  }

  if (energy === "baixa") {
    score -= 14;
    reasonCodes.push("energy_low");
  } else if (energy === "alta") {
    score += 4;
    reasonCodes.push("energy_high");
  }

  if (soreness != null && soreness >= 4) {
    score -= 12;
    reasonCodes.push("recovery_low");
  } else if (soreness != null && soreness >= 3) {
    score -= 5;
  }

  if (stress != null && stress >= 4) {
    score -= 10;
    if (!reasonCodes.includes("recovery_low")) reasonCodes.push("recovery_low");
  }

  if (rpeLoad >= 2) {
    score -= 10 + Math.min(8, (rpeLoad - 2) * 4);
    reasonCodes.push("rpe_high");
  }

  if (recentTrainingLoad >= 3) score -= 6;
  if (muscleFreshnessAvg != null && muscleFreshnessAvg < 45) {
    score -= 10;
    if (!reasonCodes.includes("recovery_low")) reasonCodes.push("recovery_low");
  } else if (muscleFreshnessAvg != null && muscleFreshnessAvg > 75) {
    score += 4;
  }

  score = Math.max(5, Math.min(98, Math.round(score)));

  const forcedLow =
    (sleepDuration != null && sleepDuration < 6) ||
    energy === "baixa" ||
    (soreness != null && soreness >= 4) ||
    rpeLoad >= 2;

  let level: RecoveryLevel;
  if (forcedLow || score < 50) {
    level = "low";
    if (!reasonCodes.includes("recovery_low")) reasonCodes.push("recovery_low");
  } else if (score >= 70 && !reasonCodes.includes("rpe_high")) {
    level = "recovered";
  } else {
    level = "moderate";
  }

  const explanation = buildRecoveryExplanation(level, manual, reasonCodes);

  let confidence = 0.5;
  if (checkIn) confidence += 0.2;
  if (sleepValues.length >= 3) confidence += 0.1;
  if (state.sessions.length >= 4) confidence += 0.08;
  if (!checkIn) confidence -= 0.12;
  confidence = Math.round(Math.max(0.35, Math.min(0.92, confidence)) * 1000) / 1000;

  return {
    level,
    score,
    explanation,
    reasonCodes: [...new Set(reasonCodes)],
    signals: { manual, wearable },
    confidence,
    manualOnly: true,
  };
}

function buildRecoveryExplanation(
  level: RecoveryLevel,
  manual: RecoveryManualSignals,
  codes: ReasonCode[],
): string {
  const parts: string[] = [];
  if (manual.sleepDuration != null) parts.push(`sono ${manual.sleepDuration}h`);
  if (manual.energy) parts.push(`energia ${manual.energy}`);
  if (manual.soreness != null) parts.push(`dor ${manual.soreness}/5`);
  if (manual.stress != null) parts.push(`estresse ${manual.stress}/5`);
  if (manual.rpeLoad >= 2) parts.push(`${manual.rpeLoad} RPE difíceis seguidos`);
  if (manual.muscleFreshnessAvg != null) {
    parts.push(`frescor muscular ~${manual.muscleFreshnessAvg}%`);
  }

  const detail = parts.length ? parts.join(", ") : "sinais manuais limitados";
  const wearableNote = "Sem wearable conectado (HRV/FC repouso não usados).";

  if (level === "low") {
    return `Readiness baixa (${detail}). ${wearableNote}`;
  }
  if (level === "moderate") {
    return `Readiness moderada (${detail}). ${wearableNote}`;
  }
  const positive = codes.includes("sleep_good") || codes.includes("energy_high");
  return positive
    ? `Readiness boa (${detail}). ${wearableNote}`
    : `Readiness recuperada com base nos sinais manuais (${detail}). ${wearableNote}`;
}
