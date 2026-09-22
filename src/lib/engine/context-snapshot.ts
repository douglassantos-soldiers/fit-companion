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
  type LearningSnapshot,
} from "@/lib/engine/learning";
import {
  activePatterns,
  extractLearnedPatterns,
  type LearnedPattern,
} from "@/lib/engine/learned-patterns";
import { computeRecoverySnapshot, consecutiveHardRpeStreak } from "@/lib/engine/recovery";
import type {
  ReadinessLevel,
  RecoveryLevel,
  RecoverySnapshot,
  RecoverySourceSummary,
} from "@/lib/engine/recovery";
import { plateauExerciseIds, listExercisesWithHistory } from "@/lib/engine/exercise-history";
import { computeMuscleLoad } from "@/lib/training/muscle-load";
import { detectTravelFromNotes, type ReasonCode } from "@/lib/engine/reason-codes";
import { computeWeeklyKcalAdaptation } from "@/lib/engine/nutrition/weekly-kcal-adapt";
import { recentDayCheckIns } from "@/lib/sync/day-checkin";
import { resolvedAvailableMin } from "@/lib/engine/session-time";
import { blockPhaseWeekHint } from "@/lib/training/training-block";
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
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
    readiness?: ReadinessLevel;
    fatigueSignal: boolean;
    sorenessAvg: number | null;
    stressAvg: number | null;
    explanation: string | null;
    confidence?: number;
    sleepConfidence?: number;
    checkInConfidence?: number;
    wearableConfidence?: number;
    sourceSummary?: RecoverySourceSummary;
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

export function buildContextSnapshot(
  state: AppState,
  date = todayKey(),
  userId?: string | null,
  recovery?: RecoverySnapshot,
  learning?: LearningSnapshot,
): ContextSnapshot | null {
  const profile = state.profile;
  if (!profile) return null;

  const uid = userId ?? state.userId ?? null;
  const recoverySnap = recovery ?? computeRecoverySnapshot(state, date);
  const c360 = buildCustomer360FromState(
    state,
    uid != null
      ? { userId: uid, date, recoverySnapshot: recoverySnap }
      : { date, recoverySnapshot: recoverySnap },
  );
  const insights = learning?.insights ?? computeLearningInsights(state, date);
  const patterns = extractUserPatterns(state);
  const learned = learning?.learnedPatterns ?? extractLearnedPatterns(state, null, date);
  const active = activePatterns(learned);
  const checkIn = state.dayCheckIns?.[date];
  const hasCheckInToday = Boolean(checkIn);

  let sleepHours: number | null = null;
  let sleepSource: ContextSnapshot["sleep"]["source"] = "unknown";
  if (recoverySnap.sourceSummary.sleep === "checkin" && recoverySnap.sleep != null) {
    sleepHours = recoverySnap.sleep;
    sleepSource = "checkin";
  } else if (checkIn?.sleepHours != null) {
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
  const adhereDims = dims.filter((d) => ["nutricao", "suplementacao", "habitos"].includes(d.key));

  const sessions7d = sessionsInLastDays(state.sessions, 7);
  const cutoff3 = dateNDaysAgo(3, date);
  const sessions3d = state.sessions.filter((s) => s.date.slice(0, 10) >= cutoff3);
  const hardCount = sessions3d.filter((s) => s.rpe === "dificil").length;
  const hardStreak = insights?.hardRpeStreak ?? consecutiveHardRpeStreak(state.sessions);
  const learnedHint = insights?.adaptations.weekHint ?? null;
  const weekHint =
    learnedHint === "deload" || learnedHint === "push"
      ? learnedHint
      : (blockPhaseWeekHint(state.activeTrainingBlock, date) ?? learnedHint);

  const volumeLoad: ContextSnapshot["training"]["volumeLoad"] =
    hardStreak >= 2 || weekHint === "deload" ? "high" : sessions7d.length <= 1 ? "low" : "normal";

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

  if (sleepSource === "checkin" && sleepHours != null && sleepHours < 6)
    reasonSeeds.push("sleep_low");
  else if (sleepSource === "checkin" && sleepHours != null && sleepHours >= 7)
    reasonSeeds.push("sleep_good");

  if (checkIn?.energy === "baixa") reasonSeeds.push("energy_low");
  else if (checkIn?.energy === "alta") reasonSeeds.push("energy_high");

  if (hardStreak >= 2) reasonSeeds.push("rpe_high");
  if (recoverySnap.readiness === "low" || recoverySnap.fatigueSignal) {
    reasonSeeds.push("recovery_low");
  }
  for (const code of recoverySnap.reasonCodes) {
    if (!reasonSeeds.includes(code)) reasonSeeds.push(code);
  }
  if (insights && insights.proteinAdherence7d < 0.7) reasonSeeds.push("protein_low");
  if (insights && insights.proteinAdherence7d < 0.55) reasonSeeds.push("nutrition_adherence_low");
  // weight_trend_* only from weekly-kcal-adapt (below) — no duplicate ±0.5 seeds

  const baseGoals = nutritionGoals(profile);
  let avgIntake: number | null = null;
  {
    let sum = 0;
    let days = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(`${date}T12:00:00`);
      d.setDate(d.getDate() - i);
      const key = todayKey(d);
      const dayMeals = (state.meals ?? []).filter((m) => m.date === key);
      if (dayMeals.length) {
        sum += dayNutritionTotals(state.meals ?? [], key).kcal;
        days += 1;
      }
    }
    if (days > 0) avgIntake = Math.round(sum / days);
  }

  const weeklyKcal = computeWeeklyKcalAdaptation({
    goal: profile.goal,
    date,
    weightTrendKg7d: c360.nutrition.weightTrendKg7d,
    loggingCompleteness7d: c360.nutrition.loggingCompleteness7d ?? 0,
    kcalAdherence: c360.nutrition.kcalAdherence?.value ?? null,
    avgIntakeKcal: avgIntake,
    targetKcal: baseGoals.kcal,
  });
  for (const code of weeklyKcal.reasonCodes) {
    if (!reasonSeeds.includes(code)) reasonSeeds.push(code);
  }
  if (checkIn && checkIn.availableMin < 40) reasonSeeds.push("time_limited");
  if (
    active.some((p) => p.kind === "prefers_short_sessions") &&
    resolvedAvailableMin(checkIn, profile) <= 50
  ) {
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
    if (hist.some((h) => h.hits.length >= 2 && h.trend === "up"))
      reasonSeeds.push("pr_opportunity");
  }

  let confidenceBase = recoverySnap.confidence;
  if (hasCheckInToday) confidenceBase = Math.max(confidenceBase, 0.6);
  if (sessions7d.length >= 3) confidenceBase += 0.05;
  if (recentChecks.length >= 3) confidenceBase += 0.05;
  if (!hasCheckInToday) confidenceBase -= 0.08;
  if (state.sessions.length < 3) confidenceBase -= 0.08;
  confidenceBase = Math.max(0.2, Math.min(0.9, confidenceBase));

  const recoverySlice: ContextSnapshot["recovery"] = {
    score: recoverySnap.score,
    level: recoverySnap.level,
    readiness: recoverySnap.readiness,
    fatigueSignal: recoverySnap.fatigueSignal,
    sorenessAvg: recoverySnap.soreness,
    stressAvg: recoverySnap.stress,
    explanation: recoverySnap.explanation,
    confidence: recoverySnap.confidence,
    sleepConfidence: recoverySnap.sleepConfidence,
    checkInConfidence: recoverySnap.checkInConfidence,
    wearableConfidence: recoverySnap.wearableConfidence,
    sourceSummary: recoverySnap.sourceSummary,
  };

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
      kcalTrend: weeklyKcal.delta,
      weightTrendKg7d: c360.nutrition.weightTrendKg7d,
    },
    recovery: recoverySlice,
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
