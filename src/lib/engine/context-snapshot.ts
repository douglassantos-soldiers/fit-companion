/**
 * Canonical Context Snapshot — "How is this person today?"
 * Aggregates Customer 360 + check-in + history + goal + environment + commerce.
 */
import { buildCustomer360FromState } from "@/lib/customer360";
import {
  adherenceScore,
  performanceDimensions,
  performanceScore,
  sessionsInLastDays,
} from "@/lib/engine/dimensions";
import {
  computeLearningInsights,
  extractUserPatterns,
  type UserPatterns,
} from "@/lib/engine/learning";
import { activePatterns, extractLearnedPatterns, type LearnedPattern } from "@/lib/engine/learned-patterns";
import { computeRecoveryV2, type RecoveryLevel } from "@/lib/engine/recovery-v2";
import { plateauExerciseIds, listExercisesWithHistory } from "@/lib/engine/exercise-history";
import { computeMuscleLoad } from "@/lib/training/muscle-load";
import {
  detectTravelFromNotes,
  type ReasonCode,
} from "@/lib/engine/reason-codes";
import { recentDayCheckIns } from "@/lib/sync/day-checkin";
import { resolvedAvailableMin } from "@/lib/engine/session-time";
import {
  todayKey,
  type AppState,
  type DayEnergy,
  type Equipment,
  type Goal,
  type TrainingMode,
} from "@/lib/types";

export type ContextSnapshot = {
  date: string;
  goal: Goal;
  training: {
    recentSessions7d: number;
    hardRpeStreak: number;
    weekHint: "deload" | "push" | "normal" | null;
    volumeLoad: "low" | "normal" | "high";
  };
  nutrition: {
    proteinAdherence7d: number | null;
    kcalTrend: number | null;
    weightTrendKg7d: number | null;
  };
  recovery: {
    score: number | null;
    level: RecoveryLevel | null;
    fatigueSignal: boolean;
    sorenessAvg: number | null;
    stressAvg: number | null;
    explanation: string | null;
  };
  sleep: {
    hours: number | null;
    avg7d: number | null;
    source: "checkin" | "profile" | "unknown";
  };
  energy: DayEnergy | null;
  adherence: {
    performanceScore: number | null;
    adherenceScore: number | null;
    supplementPct30d: number | null;
  };
  recentWorkload: {
    sessions3d: number;
    hardCount: number;
  };
  availableTimeMin: number | null;
  equipment: {
    profile: Equipment;
    limitedToday: boolean;
  };
  acceptedTrainingMode: TrainingMode | null;
  behavioralPatterns: UserPatterns | null;
  activePatterns: LearnedPattern[];
  supplements: {
    routineCount: number;
    takenToday: number;
    restockRiskIds: string[];
  };
  commerce: {
    accessTier: "base" | "performance";
    purchaseCount: number;
    restockSoon: boolean;
  };
  travel: boolean;
  reasonSeeds: ReasonCode[];
  /** 0–1 base confidence (↑ with today's check-in). */
  confidenceBase: number;
  hasCheckInToday: boolean;
};

function dateNDaysAgo(n: number, from = todayKey()) {
  const d = new Date(`${from}T12:00:00`);
  d.setDate(d.getDate() - n);
  return todayKey(d);
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

export function buildContextSnapshot(
  state: AppState,
  date = todayKey(),
  userId?: string | null,
): ContextSnapshot | null {
  const profile = state.profile;
  if (!profile) return null;

  const uid = userId ?? state.userId ?? null;
  const c360 = buildCustomer360FromState(state, uid != null ? { userId: uid } : undefined);
  const insights = computeLearningInsights(state);
  const patterns = extractUserPatterns(state);
  const learned = extractLearnedPatterns(state);
  const active = activePatterns(learned);
  const recoveryV2 = computeRecoveryV2(state, date);
  const checkIn = state.dayCheckIns?.[date];
  const hasCheckInToday = Boolean(checkIn);

  let sleepHours: number | null = null;
  let sleepSource: ContextSnapshot["sleep"]["source"] = "unknown";
  if (checkIn?.sleepHours != null) {
    sleepHours = checkIn.sleepHours;
    sleepSource = "checkin";
  } else if (profile.typicalSleepHours != null) {
    sleepHours = profile.typicalSleepHours;
    sleepSource = "profile";
  }

  const recentChecks = recentDayCheckIns(state.dayCheckIns, 7);
  const sleepAvg7d = recentChecks.length
    ? recentChecks.reduce((s, c) => s + c.sleepHours, 0) / recentChecks.length
    : null;

  const dims = performanceDimensions(state, profile);
  const perfDims = dims.filter((d) =>
    ["forca", "resistencia", "consistencia", "recuperacao", "sono"].includes(d.key),
  );
  const adhereDims = dims.filter((d) =>
    ["nutricao", "suplementacao", "habitos"].includes(d.key),
  );
  const recoveryDim = dims.find((d) => d.key === "recuperacao");

  const sessions7d = sessionsInLastDays(state.sessions, 7);
  const cutoff3 = dateNDaysAgo(3, date);
  const sessions3d = state.sessions.filter((s) => s.date.slice(0, 10) >= cutoff3);
  const hardCount = sessions3d.filter((s) => s.rpe === "dificil").length;
  const hardStreak = insights?.hardRpeStreak ?? hardRpeStreak(state.sessions);
  const weekHint = insights?.adaptations.weekHint ?? null;

  const volumeLoad: ContextSnapshot["training"]["volumeLoad"] =
    hardStreak >= 2 || weekHint === "deload"
      ? "high"
      : sessions7d.length <= 1
        ? "low"
        : "normal";

  const limitedToday = checkIn?.noEquipment === true;
  const travel = detectTravelFromNotes(checkIn?.notes) || detectTravelFromNotes(state.bio);

  const restockRiskIds = Object.values(c360.supplements.restockEstimates)
    .filter((r) => r.daysLeft <= 12)
    .map((r) => r.productId);

  const takenToday = (state.supplementLogs[date] ?? []).length;
  const supplementPct =
    insights?.supplementAdherence30d != null
      ? Math.round(insights.supplementAdherence30d * 100)
      : c360.supplements.adherence30d != null
        ? Math.round(c360.supplements.adherence30d * 100)
        : null;

  const adhereScore = adherenceScore(dims);
  const reasonSeeds: ReasonCode[] = [];

  if (sleepHours != null && sleepHours < 6) reasonSeeds.push("sleep_low");
  else if (sleepHours != null && sleepHours >= 7) reasonSeeds.push("sleep_good");

  if (checkIn?.energy === "baixa") reasonSeeds.push("energy_low");
  else if (checkIn?.energy === "alta") reasonSeeds.push("energy_high");

  if (hardStreak >= 2) reasonSeeds.push("rpe_high");
  if (
    recoveryV2.level === "low" ||
    c360.recovery.fatigueSignal ||
    (recoveryDim && recoveryDim.score < 50)
  ) {
    reasonSeeds.push("recovery_low");
  }
  for (const code of recoveryV2.reasonCodes) {
    if (!reasonSeeds.includes(code)) reasonSeeds.push(code);
  }
  if (insights && insights.proteinAdherence7d < 0.7) reasonSeeds.push("protein_low");
  if (insights && insights.proteinAdherence7d < 0.55) reasonSeeds.push("nutrition_adherence_low");
  if (c360.nutrition.weightTrendKg7d != null && c360.nutrition.weightTrendKg7d <= -0.5) {
    reasonSeeds.push("weight_trend_down");
  }
  if (checkIn && checkIn.availableMin < 40) reasonSeeds.push("time_limited");
  if (active.some((p) => p.kind === "prefers_short_sessions") && resolvedAvailableMin(checkIn, profile) <= 50) {
    reasonSeeds.push("time_limited");
  }
  if (active.some((p) => p.kind === "prefers_short_sessions" && p.successfulOutcomes >= 2)) {
    reasonSeeds.push("express_high_adherence");
  }
  if (
    patterns.mealGapWeekend ||
    active.some((p) => p.kind === "weekend_protein_drop" || p.kind === "sunday_meal_gap")
  ) {
    reasonSeeds.push("weekend_adherence_pattern");
  }
  if (travel) reasonSeeds.push("travel");
  if (limitedToday) reasonSeeds.push("equipment_limited");
  if (adhereScore < 45) reasonSeeds.push("adherence_drop");
  if (weekHint === "deload") reasonSeeds.push("deload_week");
  if (restockRiskIds.length) reasonSeeds.push("restock_risk");
  if (plateauExerciseIds(state.sessions).length >= 2) reasonSeeds.push("plateau_detected");

  {
    const loads = computeMuscleLoad(state.sessions);
    if (loads.some((m) => m.muscle !== "cardio" && m.rolling_7d >= 16)) {
      reasonSeeds.push("excessive_muscle_load");
    }
    if (loads.filter((m) => m.muscle !== "cardio" && m.rolling_7d < 2).length >= 3) {
      reasonSeeds.push("undertrained_muscle");
    }
    if (loads.some((m) => m.muscle !== "cardio" && m.rolling_7d > 0 && m.rolling_7d <= 6)) {
      reasonSeeds.push("low_muscle_fatigue");
    }
    const hist = listExercisesWithHistory(state.sessions, 12);
    if (hist.some((h) => h.trend === "up" && !h.plateau)) reasonSeeds.push("progression_ready");
    if (hist.some((h) => h.hits.length >= 2 && h.trend === "up")) reasonSeeds.push("pr_opportunity");
  }

  let confidenceBase = recoveryV2.confidence;
  if (hasCheckInToday) confidenceBase = Math.max(confidenceBase, 0.6);
  if (sessions7d.length >= 3) confidenceBase += 0.05;
  if (recentChecks.length >= 3) confidenceBase += 0.05;
  if (!hasCheckInToday) confidenceBase -= 0.08;
  if (state.sessions.length < 3) confidenceBase -= 0.08;
  confidenceBase = Math.max(0.35, Math.min(0.9, confidenceBase));

  return {
    date,
    goal: profile.goal,
    training: {
      recentSessions7d: sessions7d.length,
      hardRpeStreak: hardStreak,
      weekHint,
      volumeLoad,
    },
    nutrition: {
      proteinAdherence7d: insights?.proteinAdherence7d ?? null,
      kcalTrend: insights?.adaptations.kcalDelta ?? null,
      weightTrendKg7d: c360.nutrition.weightTrendKg7d,
    },
    recovery: {
      score: recoveryV2.score,
      level: recoveryV2.level,
      fatigueSignal: recoveryV2.level === "low" || c360.recovery.fatigueSignal,
      sorenessAvg: recoveryV2.signals.manual.soreness,
      stressAvg: recoveryV2.signals.manual.stress,
      explanation: recoveryV2.explanation,
    },
    sleep: {
      hours: sleepHours,
      avg7d: sleepAvg7d != null ? Math.round(sleepAvg7d * 10) / 10 : c360.recovery.sleepAvg7d,
      source: sleepSource,
    },
    energy: checkIn?.energy ?? null,
    adherence: {
      performanceScore: performanceScore(perfDims),
      adherenceScore: adhereScore,
      supplementPct30d: supplementPct,
    },
    recentWorkload: {
      sessions3d: sessions3d.length,
      hardCount,
    },
    availableTimeMin: resolvedAvailableMin(checkIn, profile),
    equipment: {
      profile: profile.equipment,
      limitedToday,
    },
    acceptedTrainingMode: checkIn?.acceptedTrainingMode ?? null,
    behavioralPatterns: patterns,
    activePatterns: active,
    supplements: {
      routineCount: state.supplementRoutine.length,
      takenToday,
      restockRiskIds,
    },
    commerce: {
      accessTier: state.accessTier === "performance" ? "performance" : "base",
      purchaseCount: state.purchaseProductIds?.length ?? 0,
      restockSoon: restockRiskIds.length > 0,
    },
    travel,
    reasonSeeds: [...new Set(reasonSeeds)],
    confidenceBase,
    hasCheckInToday,
  };
}
