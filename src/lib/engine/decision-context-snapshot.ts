/**
 * DecisionContextSnapshot — client-safe envelope of the day's intelligence.
 * Engines calculate; this type is the consumption contract for Today / Training / Nutrition / Coach.
 * AppState may cache it; it is never the business authority when a server snapshot exists.
 */
import { buildExpressSession, type PlannedDay } from "@/lib/engine/plan";
import type { ContextSnapshot } from "@/lib/engine/context-snapshot";
import type { DecisionBundle } from "@/lib/engine/decision";
import type { Recommendation } from "@/lib/engine/recommendation";
import type { SafetyVerdict } from "@/lib/engine/safety";
import type { BehaviorLoopResult } from "@/lib/engine/behavior/types";
import type { MealPlanEngineOpts } from "@/lib/nutrition/meal-planner";
import type { AppState, LivingPlanSnapshot, TrainingMode } from "@/lib/types";
import { todayKey } from "@/lib/types";

export const DECISION_ENGINE_VERSION = "decision_v1";

export type DecisionContextSource = "server" | "offline_legacy";

export type DecisionContextSnapshot = {
  userId: string;
  date: string;
  timezone: string;
  customer360Version: number | null;
  stale360: boolean;
  engineVersion: string;
  snapshotVersion: number;
  inputFingerprint: string;
  source: DecisionContextSource;
  safety: SafetyVerdict;
  context: ContextSnapshot;
  decisions: DecisionBundle;
  recommendations: Recommendation[];
  livingPlan: LivingPlanSnapshot;
  behavior?: BehaviorLoopResult;
};

export type DecisionInputFingerprintParts = {
  date: string;
  timezone: string;
  customer360Version: number | null;
  engineVersion: string;
  sleepHours: number | null;
  energy: string | null;
  availableTimeMin: number | null;
  equipmentProfile: string;
  equipmentLimitedToday: boolean;
  acceptedTrainingMode: string | null;
  recoveryScore: number | null;
  recoveryLevel: string | null;
  recoveryReadiness?: string | null;
  recoveryConfidence?: number | null;
  proteinAdherence7d: number | null;
  plannedMinutes: number;
  hasTrainingDay: boolean;
  reasonSeeds: string[];
  behaviorTriggers: string[];
  learningConfidence?: number | null;
  /** Block / sticky / generated — invalidates cache on enroll or activate routine */
  planSource?: string;
};

export function fingerprintDecisionInputs(parts: DecisionInputFingerprintParts): string {
  const canonical = [
    parts.date,
    parts.timezone,
    String(parts.customer360Version ?? ""),
    parts.engineVersion,
    String(parts.sleepHours ?? ""),
    parts.energy ?? "",
    String(parts.availableTimeMin ?? ""),
    parts.equipmentProfile,
    parts.equipmentLimitedToday ? "1" : "0",
    parts.acceptedTrainingMode ?? "",
    String(parts.recoveryScore ?? ""),
    parts.recoveryLevel ?? "",
    parts.recoveryReadiness ?? "",
    String(parts.recoveryConfidence ?? ""),
    String(parts.proteinAdherence7d ?? ""),
    String(parts.plannedMinutes),
    parts.hasTrainingDay ? "1" : "0",
    [...parts.reasonSeeds].sort().join(","),
    [...parts.behaviorTriggers].sort().join(","),
    String(parts.learningConfidence ?? ""),
    parts.planSource ?? "generated",
  ].join("|");
  return `v1:${djb2(canonical)}`;
}

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) + h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

/** Idempotent version bump: same fingerprint keeps the version. */
export function nextSnapshotVersion(
  existing: { inputFingerprint: string; snapshotVersion: number } | null,
  incomingFingerprint: string,
): number {
  if (existing && existing.inputFingerprint === incomingFingerprint) {
    return existing.snapshotVersion;
  }
  return (existing?.snapshotVersion ?? 0) + 1;
}

export function selectTrainingMode(snapshot: DecisionContextSnapshot): TrainingMode {
  return snapshot.decisions.trainingMode;
}

export function selectSessionDuration(snapshot: DecisionContextSnapshot): number {
  return snapshot.decisions.sessionDuration;
}

export function selectPrimaryAction(
  snapshot: DecisionContextSnapshot,
): DecisionBundle["primaryAction"] {
  return snapshot.decisions.primaryAction;
}

export function selectVolumeFactor(snapshot: DecisionContextSnapshot): number {
  return snapshot.decisions.trainingVolume;
}

export function selectCalorieDelta(snapshot: DecisionContextSnapshot): number {
  return snapshot.decisions.calorieDelta;
}

export function selectNutritionOpts(
  snapshot: DecisionContextSnapshot,
  state?: AppState,
): MealPlanEngineOpts {
  const bundle = snapshot.decisions;
  const opts: MealPlanEngineOpts = {};
  if (bundle.calorieDelta) opts.calorieDelta = bundle.calorieDelta;
  if (bundle.proteinBias) opts.proteinBias = bundle.proteinBias;
  if (bundle.mealDistribution) opts.mealDistribution = bundle.mealDistribution;
  if (bundle.trainingMode) opts.trainingMode = bundle.trainingMode;
  const check = state?.dayCheckIns?.[snapshot.date];
  if (check?.lunchOutToday) opts.lunchOutToday = true;
  if (check?.skippedSlots?.length) opts.skippedSlots = check.skippedSlots;
  if (state?.favoriteMealPresetIds?.length) opts.favoritePresetIds = state.favoriteMealPresetIds;
  return opts;
}

export { selectWhyPanel } from "@/lib/engine/decision-contract";
export type { WhyPanel } from "@/lib/engine/decision-contract";

export function applyDecisionContextToState(
  state: AppState,
  snapshot: DecisionContextSnapshot,
): AppState {
  return {
    ...state,
    livingPlans: { ...(state.livingPlans ?? {}), [snapshot.date]: snapshot.livingPlan },
    decisionContextByDate: {
      ...(state.decisionContextByDate ?? {}),
      [snapshot.date]: snapshot,
    },
  };
}

/**
 * UI consumption: never replace a server snapshot with a silent local recompute.
 * Missing cache → offline_legacy assembler (explicit compatibility).
 */
export function resolveDecisionContextForUi(
  state: AppState,
  date = todayKey(),
  assemble?: (state: AppState, date: string) => DecisionContextSnapshot | null,
): DecisionContextSnapshot | null {
  const cached = state.decisionContextByDate?.[date];
  if (cached?.source === "server") return cached;
  if (!assemble) return cached ?? null;
  if (cached?.source === "offline_legacy") {
    const assembled = assemble(state, date);
    if (assembled && cached.inputFingerprint === assembled.inputFingerprint) {
      return cached;
    }
    return assembled ?? cached;
  }
  return assemble(state, date) ?? cached ?? null;
}

/** One hydrate/refresh pass until a server snapshot exists — never loop on livingPlans writes. */
export function shouldRefreshDecisionContextForToday(opts: {
  snapshot: DecisionContextSnapshot | null | undefined;
  hasLivingPlan: boolean;
  alreadyRequested: boolean;
}): boolean {
  if (opts.snapshot?.source === "server") return false;
  if (opts.alreadyRequested && opts.hasLivingPlan) return false;
  return true;
}

export function todaySessionShouldBeExpress(opts: {
  snapshot: DecisionContextSnapshot | null;
  isTodaySession: boolean;
  acceptedTrainingMode?: TrainingMode | null;
}): boolean {
  if (!opts.isTodaySession) return false;
  if (opts.acceptedTrainingMode === "express") return true;
  return opts.snapshot ? selectTrainingMode(opts.snapshot) === "express" : false;
}

export function applySnapshotToPlannedDay(
  day: PlannedDay,
  snapshot: DecisionContextSnapshot | null,
): PlannedDay {
  if (!snapshot) return day;
  if (selectTrainingMode(snapshot) === "express") return buildExpressSession(day);
  return day;
}

export function isTodayPlannedDay(
  dayId: string,
  snapshot: DecisionContextSnapshot | null,
): boolean {
  const todayId = snapshot?.livingPlan.workout.dayId;
  if (!todayId) return false;
  const base = dayId.replace(/-express$/, "");
  return base === todayId || dayId === todayId;
}
