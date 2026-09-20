/**
 * Decision Engine (FASE 4) — deterministic rules only; no LLM.
 * Extracts training/nutrition/stim decisions from Context Snapshot + Safety.
 */
import type { ContextSnapshot } from "@/lib/engine/context-snapshot";
import { decisionConfidence, explainWhy } from "@/lib/engine/explain";
import {
  reasonCodesFromSafetyFlags,
  type ReasonCode,
} from "@/lib/engine/reason-codes";
import type { SafetyVerdict } from "@/lib/engine/safety";
import type { LivingPlanSnapshot } from "@/lib/types";

export type DecisionType =
  | "training_mode"
  | "training_volume"
  | "session_duration"
  | "nutrition_calorie_delta"
  | "nutrition_protein_bias"
  | "meal_distribution"
  | "block_stims"
  | "primary_action"
  | "behavior_intervention"
  | "plateau_response"
  | "progression";

export type EngineDecision = {
  decisionType: DecisionType;
  decisionValue: string | number | boolean;
  reasonCodes: ReasonCode[];
  confidence: number;
  explanation: string;
};

export type DecisionBundle = {
  decisions: EngineDecision[];
  trainingMode: LivingPlanSnapshot["workout"]["mode"];
  trainingVolume: number;
  sessionDuration: number;
  calorieDelta: number;
  proteinBias: "up" | "hold";
  mealDistribution: "rebalanced" | "default";
  blockStims: boolean;
  primaryAction: "train" | "rest" | "meal" | "sleep" | "supplement";
};

function pushDecision(
  out: EngineDecision[],
  snapshot: ContextSnapshot,
  decisionType: DecisionType,
  decisionValue: string | number | boolean,
  reasonCodes: ReasonCode[],
) {
  const codes = [...new Set(reasonCodes)];
  const confidence = decisionConfidence(snapshot, codes);
  out.push({
    decisionType,
    decisionValue,
    reasonCodes: codes,
    confidence,
    explanation: explainWhy(decisionType, decisionValue, codes, snapshot),
  });
}

/**
 * Compute structured decisions for today.
 * Pure TypeScript — engines calculate; this decides; AI only explains later.
 */
export function computeDecisions(
  snapshot: ContextSnapshot,
  safety: SafetyVerdict,
  opts?: {
    /** Planned day estimated minutes before adaptation (0 = rest day). */
    plannedMinutes?: number;
    hasTrainingDay?: boolean;
  },
): DecisionBundle {
  const plannedMinutes = opts?.plannedMinutes ?? 60;
  const hasTrainingDay = opts?.hasTrainingDay ?? plannedMinutes > 0;
  const seeds = snapshot.reasonSeeds;
  const safetyCodes = reasonCodesFromSafetyFlags(safety.flags);
  const allSeeds = [...new Set([...seeds, ...safetyCodes])];

  const sleepLow = allSeeds.includes("sleep_low") || (snapshot.sleep.hours != null && snapshot.sleep.hours < 6);
  const energyLow = allSeeds.includes("energy_low") || snapshot.energy === "baixa";
  const timeLimited =
    allSeeds.includes("time_limited") ||
    (snapshot.availableTimeMin != null && snapshot.availableTimeMin < 40);
  const availableMin = snapshot.availableTimeMin ?? 60;
  const deloadWeek = allSeeds.includes("deload_week") || snapshot.training.weekHint === "deload";
  const recoveryLow =
    allSeeds.includes("recovery_low") ||
    allSeeds.includes("rpe_high") ||
    snapshot.recovery.level === "low";
  const travel = allSeeds.includes("travel") || snapshot.travel;
  const equipmentLimited = allSeeds.includes("equipment_limited") || snapshot.equipment.limitedToday;
  const proteinLow = allSeeds.includes("protein_low");
  const adherenceDrop = allSeeds.includes("adherence_drop");
  const sleepStress = sleepLow || energyLow;
  const prefersShort = (snapshot.activePatterns ?? []).some((p) => p.kind === "prefers_short_sessions");

  const blockStims = safety.blockStims || sleepLow;
  if (blockStims && !allSeeds.includes("stim_restriction")) {
    allSeeds.push("stim_restriction");
  }

  let trainingMode: LivingPlanSnapshot["workout"]["mode"] = hasTrainingDay ? "full" : "rest";
  let trainingVolume = 1;
  let sessionDuration = hasTrainingDay ? plannedMinutes : 0;
  const modeCodes: ReasonCode[] = [];
  const escalate = safety.escalateCare === true;
  const accepted = snapshot.acceptedTrainingMode;

  if (escalate && hasTrainingDay) {
    // Serious signals → rest path, not routine volume adaptation
    trainingMode = "rest";
    trainingVolume = 0;
    sessionDuration = 0;
    modeCodes.push(
      ...allSeeds.filter((c) =>
        ["escalate_care", "pain_signal", "high_stress", "recovery_low", "sleep_low"].includes(c),
      ),
    );
    if (!modeCodes.length) modeCodes.push("escalate_care");
  } else if (!hasTrainingDay) {
    trainingMode = "rest";
    trainingVolume = 0;
    sessionDuration = 0;
    modeCodes.push(...allSeeds.filter((c) => c === "recovery_low" || c === "rpe_high"));
    if (!modeCodes.length) modeCodes.push("sleep_good");
  } else if (accepted === "rest") {
    trainingMode = "rest";
    trainingVolume = 0;
    sessionDuration = 0;
    if (!modeCodes.length) modeCodes.push("recovery_low");
  } else if (accepted === "deload") {
    trainingMode = "deload";
    trainingVolume = 0.7;
    sessionDuration = Math.round(plannedMinutes * trainingVolume);
    modeCodes.push("deload_week");
  } else if (accepted === "express") {
    trainingMode = "express";
    trainingVolume = 0.65;
    sessionDuration = Math.min(35, availableMin, Math.round(plannedMinutes * 0.65));
    modeCodes.push("time_limited");
  } else if (accepted === "full") {
    trainingMode = "full";
    trainingVolume = 1;
    sessionDuration = plannedMinutes;
    if (allSeeds.includes("sleep_good")) modeCodes.push("sleep_good");
    if (allSeeds.includes("energy_high")) modeCodes.push("energy_high");
    if (!modeCodes.length) modeCodes.push("sleep_good");
  } else if (deloadWeek || sleepStress || safety.preferLightTraining || recoveryLow) {
    trainingMode = "deload";
    trainingVolume =
      (snapshot.sleep.hours != null && snapshot.sleep.hours < 5.5) || safety.preferLightTraining
        ? 0.55
        : 0.7;
    sessionDuration = Math.round(plannedMinutes * trainingVolume);
    modeCodes.push(
      ...allSeeds.filter((c) =>
        ["sleep_low", "energy_low", "rpe_high", "recovery_low", "deload_week", "stim_restriction"].includes(
          c,
        ),
      ),
    );
  } else if (
    timeLimited ||
    travel ||
    availableMin < plannedMinutes * 0.7 ||
    (prefersShort && availableMin <= 50) ||
    (allSeeds.includes("express_high_adherence") && availableMin < 35)
  ) {
    trainingMode = "express";
    trainingVolume = 0.65;
    sessionDuration = Math.min(35, availableMin, Math.round(plannedMinutes * 0.65));
    modeCodes.push(
      ...allSeeds.filter((c) =>
        ["time_limited", "travel", "equipment_limited", "express_high_adherence"].includes(c),
      ),
    );
    if (prefersShort && !modeCodes.includes("time_limited")) modeCodes.push("time_limited");
    if (!modeCodes.length) modeCodes.push("time_limited");
  } else {
    trainingMode = "full";
    trainingVolume = 1;
    sessionDuration = plannedMinutes;
    if (allSeeds.includes("sleep_good")) modeCodes.push("sleep_good");
    if (allSeeds.includes("energy_high")) modeCodes.push("energy_high");
    if (!modeCodes.length) modeCodes.push("sleep_good");
  }

  // Travel + equipment: prefer express even if already full (unless coach/user locked full)
  if (hasTrainingDay && accepted !== "full" && (travel || equipmentLimited) && trainingMode === "full") {
    trainingMode = "express";
    trainingVolume = 0.65;
    sessionDuration = Math.min(sessionDuration, availableMin, 35);
    modeCodes.push("travel", "equipment_limited");
  }

  // Learning bias: prefers short sessions / express_high_adherence (never overrides recovery)
  if (
    hasTrainingDay &&
    accepted !== "full" &&
    (prefersShort || allSeeds.includes("express_high_adherence")) &&
    trainingMode === "full" &&
    snapshot.recovery.level !== "low" &&
    !safety.preferLightTraining &&
    availableMin < 45
  ) {
    trainingMode = "express";
    trainingVolume = 0.65;
    sessionDuration = Math.min(35, availableMin);
    if (allSeeds.includes("express_high_adherence")) modeCodes.push("express_high_adherence");
    if (!modeCodes.includes("time_limited")) modeCodes.push("time_limited");
  }

  let calorieDelta = snapshot.nutrition.kcalTrend ?? 0;
  const calorieCodes: ReasonCode[] = [];
  if (snapshot.nutrition.weightTrendKg7d != null && snapshot.nutrition.weightTrendKg7d <= -0.5) {
    if (snapshot.goal === "massa" && calorieDelta < 150) calorieDelta = 150;
    calorieCodes.push("weight_trend_down");
  }
  if (sleepStress && snapshot.goal !== "gordura") {
    calorieDelta = Math.max(calorieDelta, 50);
    calorieCodes.push(...allSeeds.filter((c) => c === "sleep_low" || c === "energy_low"));
  }

  const proteinBias: "up" | "hold" =
    proteinLow || sleepStress || snapshot.goal === "massa" ? "up" : "hold";
  const proteinCodes: ReasonCode[] = proteinLow
    ? ["protein_low"]
    : sleepStress
      ? allSeeds.filter((c) => c === "sleep_low" || c === "energy_low")
      : [];

  const mealDistribution: "rebalanced" | "default" =
    proteinLow || adherenceDrop || sleepStress ? "rebalanced" : "default";
  const mealCodes: ReasonCode[] = [
    ...(proteinLow ? (["protein_low"] as ReasonCode[]) : []),
    ...(adherenceDrop ? (["adherence_drop"] as ReasonCode[]) : []),
    ...(allSeeds.includes("nutrition_adherence_low")
      ? (["nutrition_adherence_low"] as ReasonCode[])
      : []),
    ...(allSeeds.includes("weekend_adherence_pattern")
      ? (["weekend_adherence_pattern"] as ReasonCode[])
      : []),
  ];

  let primaryAction: DecisionBundle["primaryAction"] = "train";
  const actionCodes: ReasonCode[] = [];
  if (escalate) {
    primaryAction = "sleep";
    actionCodes.push(
      ...allSeeds.filter((c) =>
        ["escalate_care", "pain_signal", "high_stress", "sleep_low", "recovery_low"].includes(c),
      ),
    );
    if (!actionCodes.length) actionCodes.push("escalate_care");
  } else if (trainingMode === "rest" || (sleepLow && (snapshot.sleep.hours ?? 7) < 5)) {
    primaryAction = "sleep";
    actionCodes.push(...allSeeds.filter((c) => c === "sleep_low" || c === "recovery_low"));
  } else if (sleepStress && recoveryLow && hardCountHigh(snapshot)) {
    primaryAction = "rest";
    actionCodes.push(...modeCodes);
  } else if (proteinLow && (adherenceDrop || trainingMode === "deload")) {
    primaryAction = "meal";
    actionCodes.push("protein_low");
  } else if (blockStims && sleepLow) {
    primaryAction = "sleep";
    actionCodes.push("sleep_low", "stim_restriction");
  } else if (trainingMode === "deload" && safety.preferLightTraining) {
    primaryAction = "rest";
    actionCodes.push(...modeCodes);
  } else {
    primaryAction = "train";
    actionCodes.push(...modeCodes.slice(0, 2));
  }

  // Fix rest primary when mode is rest
  if (trainingMode === "rest" && primaryAction === "train") {
    primaryAction = "rest";
  }

  const decisions: EngineDecision[] = [];
  pushDecision(decisions, snapshot, "training_mode", trainingMode, modeCodes);
  pushDecision(decisions, snapshot, "training_volume", trainingVolume, modeCodes);
  pushDecision(decisions, snapshot, "session_duration", sessionDuration, modeCodes);
  pushDecision(
    decisions,
    snapshot,
    "nutrition_calorie_delta",
    calorieDelta,
    calorieCodes.length ? calorieCodes : modeCodes.slice(0, 1),
  );
  pushDecision(
    decisions,
    snapshot,
    "nutrition_protein_bias",
    proteinBias,
    proteinCodes.length ? proteinCodes : ["sleep_good"],
  );
  pushDecision(
    decisions,
    snapshot,
    "meal_distribution",
    mealDistribution,
    mealCodes.length ? mealCodes : ["sleep_good"],
  );
  pushDecision(
    decisions,
    snapshot,
    "block_stims",
    blockStims,
    blockStims ? ["stim_restriction", ...allSeeds.filter((c) => c === "sleep_low")] : ["sleep_good"],
  );
  pushDecision(
    decisions,
    snapshot,
    "primary_action",
    primaryAction,
    actionCodes.length ? actionCodes : modeCodes,
  );

  if (allSeeds.includes("plateau_detected")) {
    pushDecision(decisions, snapshot, "plateau_response", true, ["plateau_detected"]);
  }
  if (allSeeds.includes("progression_ready")) {
    pushDecision(decisions, snapshot, "progression", true, ["progression_ready"]);
  }
  if (allSeeds.includes("weekend_adherence_pattern") || allSeeds.includes("express_high_adherence")) {
    const codes: ReasonCode[] = allSeeds.filter(
      (c) => c === "weekend_adherence_pattern" || c === "express_high_adherence",
    );
    pushDecision(
      decisions,
      snapshot,
      "behavior_intervention",
      codes.includes("weekend_adherence_pattern") ? "weekend_support" : "express_bias",
      codes,
    );
  }

  return {
    decisions,
    trainingMode,
    trainingVolume,
    sessionDuration,
    calorieDelta,
    proteinBias,
    mealDistribution,
    blockStims,
    primaryAction,
  };
}

function hardCountHigh(snapshot: ContextSnapshot): boolean {
  return snapshot.recentWorkload.hardCount >= 2 || snapshot.training.hardRpeStreak >= 2;
}

export function decisionByType(
  decisions: EngineDecision[],
  type: DecisionType,
): EngineDecision | undefined {
  return decisions.find((d) => d.decisionType === type);
}

/** Compact snapshot for DB logging (no PII). */
export function sanitizeSnapshotForLog(snapshot: ContextSnapshot): Record<string, unknown> {
  return {
    date: snapshot.date,
    goal: snapshot.goal,
    training: snapshot.training,
    nutrition: snapshot.nutrition,
    recovery: {
      score: snapshot.recovery.score,
      level: snapshot.recovery.level,
      fatigueSignal: snapshot.recovery.fatigueSignal,
      sorenessAvg: snapshot.recovery.sorenessAvg,
      stressAvg: snapshot.recovery.stressAvg,
      explanation: snapshot.recovery.explanation,
    },
    sleep: { hours: snapshot.sleep.hours, avg7d: snapshot.sleep.avg7d, source: snapshot.sleep.source },
    energy: snapshot.energy,
    adherence: snapshot.adherence,
    recentWorkload: snapshot.recentWorkload,
    availableTimeMin: snapshot.availableTimeMin,
    equipment: snapshot.equipment,
    travel: snapshot.travel,
    reasonSeeds: snapshot.reasonSeeds,
    confidenceBase: snapshot.confidenceBase,
    hasCheckInToday: snapshot.hasCheckInToday,
    activePatternKinds: (snapshot.activePatterns ?? []).map((p) => p.kind),
    commerce: {
      accessTier: snapshot.commerce.accessTier,
      purchaseCount: snapshot.commerce.purchaseCount,
      restockSoon: snapshot.commerce.restockSoon,
    },
    supplements: {
      routineCount: snapshot.supplements.routineCount,
      takenToday: snapshot.supplements.takenToday,
      restockRiskCount: snapshot.supplements.restockRiskIds.length,
    },
  };
}
