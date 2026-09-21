/**
 * Authoritative Recovery Intelligence for a calendar date.
 * Missing data → unknown, never “bad recovery”. Not a medical diagnosis.
 */
import type { ReasonCode } from "@/lib/engine/reason-codes";
import { recentDayCheckIns } from "@/lib/sync/day-checkin";
import { todayKey, type AppState } from "@/lib/types";
import { buildMuscleRecoverySnapshots } from "@/lib/engine/recovery/muscle";
import {
  consecutiveHardRpeStreak,
  extractWearableRecovery,
  stddevHours,
  wearableConfidenceOf,
} from "@/lib/engine/recovery/signals";
import {
  readinessToLevel,
  type ReadinessLevel,
  type RecoverySnapshot,
  type SleepSource,
  type WearableRecoveryInput,
} from "@/lib/engine/recovery/types";

export type ComputeRecoverySnapshotOpts = {
  now?: Date;
  wearable?: WearableRecoveryInput;
};

function clampScore(n: number) {
  return Math.max(5, Math.min(98, Math.round(n)));
}

function buildExplanation(readiness: ReadinessLevel, parts: string[], wearable: boolean): string {
  const detail = parts.length ? parts.join(", ") : "sinais manuais limitados";
  const wearableNote = wearable
    ? "Wearable contribui como sinal, não substitui Safety."
    : "Sem wearable conectado (HRV/FC repouso não usados).";
  if (readiness === "unknown") {
    return `Dados insuficientes para estimar recuperação — não assumimos recuperação ruim. ${wearableNote}`;
  }
  if (readiness === "low") return `Readiness baixa (${detail}). ${wearableNote}`;
  if (readiness === "moderate") return `Readiness moderada (${detail}). ${wearableNote}`;
  return `Readiness boa (${detail}). ${wearableNote}`;
}

export function computeRecoverySnapshot(
  state: AppState,
  date = todayKey(),
  opts: ComputeRecoverySnapshotOpts = {},
): RecoverySnapshot {
  const checkIn = state.dayCheckIns?.[date];
  const recent = recentDayCheckIns(state.dayCheckIns, 7);
  const sleepValues = recent.map((c) => c.sleepHours).filter((h) => h > 0);
  const wearable = extractWearableRecovery(state, opts.wearable);
  const wearableConf = wearableConfidenceOf(wearable);
  const hasWearableSignals = wearableConf > 0;

  let sleep: number | null = null;
  let sleepSource: SleepSource = "none";
  let sleepConfidence = 0;
  if (checkIn && checkIn.sleepHours > 0) {
    sleep = checkIn.sleepHours;
    sleepSource = "checkin";
    sleepConfidence = 0.85;
  } else if (hasWearableSignals && wearable.hrv != null) {
    sleepSource = "wearable";
    sleepConfidence = 0.55;
  } else if (state.profile?.typicalSleepHours != null && state.profile.typicalSleepHours > 0) {
    sleep = state.profile.typicalSleepHours;
    sleepSource = "profile";
    sleepConfidence = 0.25;
  }

  const energy = checkIn?.energy ?? null;
  const soreness = checkIn?.soreness ?? null;
  const stress = checkIn?.stress ?? null;
  const hardRpeStreak = consecutiveHardRpeStreak(state.sessions);
  const cutoff3 = (() => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  })();
  const trainingLoad = state.sessions.filter((s) => s.date.slice(0, 10) >= cutoff3).length;

  const hasCheckInSignals = Boolean(checkIn);
  const hasSessionLoad = trainingLoad > 0 || hardRpeStreak > 0 || (state.sessions?.length ?? 0) > 0;
  const insufficient = !hasCheckInSignals && !hasSessionLoad && !hasWearableSignals;

  let checkInConfidence = 0;
  if (checkIn) {
    checkInConfidence = 0.45;
    if (checkIn.soreness != null) checkInConfidence += 0.2;
    if (checkIn.stress != null) checkInConfidence += 0.2;
    checkInConfidence = Math.min(1, checkInConfidence);
  }

  const sourceSummary = {
    sleep: insufficient && sleepSource === "profile" ? ("none" as const) : sleepSource,
    checkIn: hasCheckInSignals,
    wearable: hasWearableSignals,
    sessions: state.sessions?.length ?? 0,
  };

  if (insufficient) {
    return {
      date,
      score: null,
      level: "unknown",
      readiness: "unknown",
      sleep: null,
      energy,
      soreness,
      stress,
      hardRpeStreak,
      trainingLoad,
      muscleLoad: { avgFreshness: null, highLoadGroups: 0 },
      fatigueSignal: false,
      reasonCodes: [],
      confidence: 0.2,
      sleepConfidence: sleepSource === "profile" ? 0 : sleepConfidence,
      checkInConfidence,
      wearableConfidence: wearableConf,
      sourceSummary,
      explanation: buildExplanation("unknown", [], hasWearableSignals),
      muscles: [],
      wearable,
    };
  }

  const sleepForMuscle = sleepSource === "checkin" || sleepSource === "wearable" ? sleep : null;
  const muscles = buildMuscleRecoverySnapshots(
    state.sessions,
    {
      ...(sleepForMuscle != null ? { sleepHours: sleepForMuscle } : {}),
      ...(energy ? { energy } : {}),
      sessionRpeHardStreak: hardRpeStreak,
    },
    opts.now ?? new Date(),
  );
  const muscleFreshnessAvg = muscles.length
    ? Math.round(muscles.reduce((s, m) => s + m.freshness, 0) / muscles.length)
    : null;
  const highLoadGroups = muscles.filter((m) => m.muscle !== "cardio" && m.load7d >= 16).length;

  const sleepAuthoritative = sleepSource === "checkin" || sleepSource === "wearable";
  let score = 72;
  const reasonCodes: ReasonCode[] = [];
  const parts: string[] = [];

  if (sleepAuthoritative && sleep != null) {
    parts.push(`sono ${sleep}h`);
    if (sleep < 6) {
      score -= 22;
      reasonCodes.push("sleep_low");
    } else if (sleep < 7) {
      score -= 8;
    } else {
      score += 4;
      reasonCodes.push("sleep_good");
    }
  }

  const sleepConsistency = stddevHours(sleepValues);
  if (sleepConsistency != null && sleepConsistency > 1.2 && sleepAuthoritative) {
    score -= 8;
  }

  if (energy === "baixa") {
    score -= 14;
    reasonCodes.push("energy_low");
    parts.push("energia baixa");
  } else if (energy === "alta") {
    score += 4;
    reasonCodes.push("energy_high");
    parts.push("energia alta");
  } else if (energy) {
    parts.push(`energia ${energy}`);
  }

  if (soreness != null) {
    parts.push(`dor ${soreness}/5`);
    if (soreness >= 4) {
      score -= 12;
      reasonCodes.push("recovery_low");
    } else if (soreness >= 3) {
      score -= 5;
    }
  }

  if (stress != null) {
    parts.push(`estresse ${stress}/5`);
    if (stress >= 4) {
      score -= 10;
      if (!reasonCodes.includes("recovery_low")) reasonCodes.push("recovery_low");
    }
  }

  if (hardRpeStreak >= 2) {
    score -= 10 + Math.min(8, (hardRpeStreak - 2) * 4);
    reasonCodes.push("rpe_high");
    parts.push(`${hardRpeStreak} RPE difíceis seguidos`);
  }

  if (trainingLoad >= 3) score -= 6;
  if (muscleFreshnessAvg != null && muscleFreshnessAvg < 45) {
    score -= 10;
    if (!reasonCodes.includes("recovery_low")) reasonCodes.push("recovery_low");
  } else if (muscleFreshnessAvg != null && muscleFreshnessAvg > 75) {
    score += 4;
  }
  if (muscleFreshnessAvg != null) parts.push(`frescor muscular ~${muscleFreshnessAvg}%`);

  if (wearable.hrv != null) {
    parts.push(`HRV ${wearable.hrv}`);
    if (wearable.hrv < 30) score -= 8;
    else if (wearable.hrv >= 50) score += 4;
  }
  if (wearable.restingHr != null && wearable.restingHr > 80) {
    score -= 4;
  }

  score = clampScore(score);

  const forcedLow =
    (sleepAuthoritative && sleep != null && sleep < 6) ||
    energy === "baixa" ||
    (soreness != null && soreness >= 4) ||
    hardRpeStreak >= 2;

  let readiness: ReadinessLevel;
  if (forcedLow || score < 50) {
    readiness = "low";
    if (!reasonCodes.includes("recovery_low")) reasonCodes.push("recovery_low");
  } else if (score >= 70 && !reasonCodes.includes("rpe_high")) {
    readiness = "high";
  } else {
    readiness = "moderate";
  }

  const uniqueCodes = [...new Set(reasonCodes)];
  let confidence = 0.45 * checkInConfidence + 0.25 * sleepConfidence + 0.2 * wearableConf;
  if (state.sessions.length >= 4) confidence += 0.08;
  if (sleepValues.length >= 3) confidence += 0.05;
  confidence = Math.round(Math.max(0.25, Math.min(0.92, confidence || 0.4)) * 1000) / 1000;

  return {
    date,
    score,
    level: readinessToLevel(readiness),
    readiness,
    sleep: sleepAuthoritative ? sleep : sleepSource === "profile" ? sleep : null,
    energy,
    soreness,
    stress,
    hardRpeStreak,
    trainingLoad,
    muscleLoad: { avgFreshness: muscleFreshnessAvg, highLoadGroups },
    fatigueSignal: readiness === "low" || hardRpeStreak >= 2,
    reasonCodes: uniqueCodes,
    confidence,
    sleepConfidence,
    checkInConfidence,
    wearableConfidence: wearableConf,
    sourceSummary,
    explanation: buildExplanation(readiness, parts, hasWearableSignals),
    muscles,
    wearable,
  };
}
