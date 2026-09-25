/**
 * AI-layer surface for PerformanceContext / Context Engine.
 * Source of truth remains in the deterministic Context Engine.
 */
export type {
  ContextSignal,
  DataFreshness,
  DerivedPerformanceData,
  ObservedPerformanceData,
  PerformanceContext,
  PerformanceContextConstraints,
  PerformanceContextIdentity,
  PerformanceContextSignals,
  PerformanceContextWearable,
  RecentOutcomeEntry,
  SignalSource,
} from "@/lib/engine/performance-context";
export { makeSignal, signalValue, toPerformanceContext } from "@/lib/engine/performance-context";
export {
  getBehaviorContext,
  getNutritionContext,
  getPerformanceContextFromSnapshot,
  getRecoveryContext,
  getTrainingContext,
} from "@/lib/engine/context-engine";
export type {
  BehaviorContextView,
  NutritionContextView,
  RecoveryContextView,
  TrainingContextView,
} from "@/lib/engine/context-engine";
