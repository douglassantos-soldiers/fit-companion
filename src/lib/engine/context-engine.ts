/**
 * Context Engine — public pure API.
 * Partial views extract domain slices from PerformanceContext (no recompute, no LLM).
 */
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import {
  toPerformanceContext,
  type ContextSignal,
  type PerformanceContext,
  type PerformanceContextConstraints,
  type PerformanceContextSignals,
  type PerformanceContextWearable,
} from "@/lib/engine/performance-context";
import type { AppState } from "@/lib/types";

export type {
  ContextSignal,
  DataFreshness,
  PerformanceContext,
  PerformanceContextIdentity,
  PerformanceContextSignals,
  SignalSource,
} from "@/lib/engine/performance-context";

export { makeSignal, signalValue, toPerformanceContext } from "@/lib/engine/performance-context";

/** Alias: snapshot → frozen PerformanceContext (no recompute). */
export function getPerformanceContextFromSnapshot(
  snapshot: DecisionContextSnapshot,
  state?: AppState | null,
): PerformanceContext {
  return toPerformanceContext(snapshot, state);
}

export type TrainingContextView = {
  domain: "training";
  observed: {
    sessions7d: number;
    acceptedTrainingMode: PerformanceContext["observed"]["acceptedTrainingMode"];
  };
  derived: {
    hardRpeStreak: number;
    weekHint: string | null;
    volumeLoad: PerformanceContext["training"]["volumeLoad"];
  };
  signals: Pick<PerformanceContextSignals, "availableTimeMin">;
  /** Decisions are NOT in this view — use pc.decisions. */
};

export type NutritionContextView = {
  domain: "nutrition";
  observed: { mealsLoggedToday: number };
  derived: {
    proteinAdherence7d: number | null;
    kcalTrend: number | null;
    weightTrendKg7d: number | null;
  };
};

export type RecoveryContextView = {
  domain: "recovery";
  observed: {
    sleepHours: number | null;
    soreness: number | null;
    stress: number | null;
    hasCheckInToday: boolean;
  };
  derived: {
    recoveryScore: number | null;
    recoveryLevel: string | null;
    recoveryReadiness: string | null;
    fatigueSignal: boolean;
  };
  signals: Pick<
    PerformanceContextSignals,
    "sleepHours" | "recoveryScore" | "soreness" | "stress" | "energy"
  >;
  wearable: PerformanceContextWearable;
  sleep: PerformanceContext["sleep"];
  constraints: PerformanceContextConstraints;
};

export type BehaviorContextView = {
  domain: "behavior";
  derived: {
    activePatternKinds: string[];
    triggers: string[];
    adherenceScore: number | null;
    travel: boolean;
  };
  constraints: PerformanceContextConstraints;
};

export function getTrainingContext(pc: PerformanceContext): TrainingContextView {
  return Object.freeze({
    domain: "training" as const,
    observed: Object.freeze({
      sessions7d: pc.observed.sessions7d,
      acceptedTrainingMode: pc.observed.acceptedTrainingMode,
    }),
    derived: Object.freeze({
      hardRpeStreak: pc.derived.hardRpeStreak,
      weekHint: pc.derived.weekHint,
      volumeLoad: pc.training.volumeLoad,
    }),
    signals: Object.freeze({
      availableTimeMin: pc.signals.availableTimeMin,
    }),
  });
}

export function getNutritionContext(pc: PerformanceContext): NutritionContextView {
  return Object.freeze({
    domain: "nutrition" as const,
    observed: Object.freeze({
      mealsLoggedToday: pc.observed.mealsLoggedToday,
    }),
    derived: Object.freeze({
      proteinAdherence7d: pc.derived.proteinAdherence7d,
      kcalTrend: pc.nutrition.kcalTrend,
      weightTrendKg7d: pc.nutrition.weightTrendKg7d,
    }),
  });
}

export function getRecoveryContext(pc: PerformanceContext): RecoveryContextView {
  return Object.freeze({
    domain: "recovery" as const,
    observed: Object.freeze({
      sleepHours: pc.observed.sleepHours,
      soreness: pc.observed.soreness,
      stress: pc.observed.stress,
      hasCheckInToday: pc.observed.hasCheckInToday,
    }),
    derived: Object.freeze({
      recoveryScore: pc.derived.recoveryScore,
      recoveryLevel: pc.derived.recoveryLevel,
      recoveryReadiness: pc.derived.recoveryReadiness,
      fatigueSignal: pc.recovery.fatigueSignal,
    }),
    signals: Object.freeze({
      sleepHours: pc.signals.sleepHours,
      recoveryScore: pc.signals.recoveryScore,
      soreness: pc.signals.soreness,
      stress: pc.signals.stress,
      energy: pc.signals.energy,
    }),
    wearable: pc.wearable,
    sleep: pc.sleep,
    constraints: pc.constraints,
  });
}

export function getBehaviorContext(pc: PerformanceContext): BehaviorContextView {
  return Object.freeze({
    domain: "behavior" as const,
    derived: Object.freeze({
      activePatternKinds: pc.behavior.activePatternKinds,
      triggers: pc.behavior.triggers,
      adherenceScore: pc.derived.adherenceScore,
      travel: pc.derived.travel,
    }),
    constraints: pc.constraints,
  });
}
