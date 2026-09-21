/**
 * Behavior Engine public API + learning outcome updates.
 */
export type {
  BehaviorEvidence,
  BehaviorExperiment,
  BehaviorIntervention,
  BehaviorLoopResult,
  BehaviorPattern,
  BehaviorPatternKey,
  BehaviorProfile,
  BehaviorSelectContext,
  BehaviorTrigger,
  BehaviorTriggerKey,
  InterventionType,
  RecoveryFromLapse,
} from "@/lib/engine/behavior/types";

export { buildBehaviorProfile } from "@/lib/engine/behavior/profile";
export { detectBehaviorPatterns, activeBehaviorPatterns } from "@/lib/engine/behavior/patterns";
export { detectBehaviorTriggers, activeTriggers } from "@/lib/engine/behavior/triggers";
export { selectInterventions } from "@/lib/engine/behavior/interventions";
export { proposeExperiments, completeExperiment } from "@/lib/engine/behavior/experiments";
export { detectLapses } from "@/lib/engine/behavior/relapse";
export {
  trainingAdherence7d,
  mealAdherence7d,
  sleepBehavior7d,
  consistencyScore,
} from "@/lib/engine/behavior/adherence";

import { computeLearningSnapshot } from "@/lib/engine/learning/snapshot";
import { applyInterventionOutcome, scalarsFromResponses } from "@/lib/engine/learning/responses";
import type { LearningOutcome } from "@/lib/engine/learning/types";
import type { LearnedPattern } from "@/lib/engine/learned-patterns";
import type {
  BehaviorLoopResult,
  BehaviorProfile,
  InterventionType,
} from "@/lib/engine/behavior/types";
import { todayKey, type AppState } from "@/lib/types";
import { buildBehaviorProfile } from "@/lib/engine/behavior/profile";
import { selectInterventions } from "@/lib/engine/behavior/interventions";

export function runBehaviorLoop(
  state: AppState,
  opts?: {
    date?: string;
    interventionResponse?: Partial<Record<InterventionType, number>>;
    interventionResponses?: import("@/lib/engine/learning/types").InterventionResponse[];
    experiments?: BehaviorLoopResult["experiments"];
    learnedPrior?: LearnedPattern[] | null;
  },
): BehaviorLoopResult {
  const date = opts?.date ?? todayKey();
  const snap = computeLearningSnapshot(state, date, {
    ...(opts?.learnedPrior != null ? { patterns: opts.learnedPrior } : {}),
    ...(opts?.interventionResponses ? { interventionResponses: opts.interventionResponses } : {}),
    ...(opts?.experiments ? { experiments: opts.experiments } : {}),
  });
  if (opts?.interventionResponse && !opts.interventionResponses) {
    const profile = buildBehaviorProfile(state, opts.interventionResponse);
    return {
      ...snap.behavior,
      profile,
      interventions: selectInterventions(snap.behavior.triggers, profile),
    };
  }
  return snap.behavior;
}

export function applyBehaviorOutcome(
  profile: BehaviorProfile,
  type: InterventionType,
  success: boolean,
): BehaviorProfile {
  return applyInterventionResult(profile, type, success ? "success" : "fail");
}

export function applyInterventionResult(
  profile: BehaviorProfile,
  type: InterventionType,
  result: LearningOutcome,
  at = todayKey(),
): BehaviorProfile {
  const fromScalar = Object.entries(profile.interventionResponse).map(([key, confidence]) => ({
    type: key as InterventionType,
    successCount: 0,
    failureCount: 0,
    neutralCount: 0,
    confidence: confidence ?? 0.5,
    lastUsedAt: null as string | null,
  }));
  const nextList = applyInterventionOutcome(fromScalar.length ? fromScalar : [], type, result, at);
  return {
    ...profile,
    interventionResponse: {
      ...profile.interventionResponse,
      ...scalarsFromResponses(nextList),
    },
  };
}
