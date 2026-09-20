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

import { buildBehaviorProfile } from "@/lib/engine/behavior/profile";
import { detectBehaviorPatterns } from "@/lib/engine/behavior/patterns";
import { detectBehaviorTriggers } from "@/lib/engine/behavior/triggers";
import { selectInterventions } from "@/lib/engine/behavior/interventions";
import { proposeExperiments } from "@/lib/engine/behavior/experiments";
import { detectLapses } from "@/lib/engine/behavior/relapse";
import type {
  BehaviorLoopResult,
  BehaviorProfile,
  InterventionType,
} from "@/lib/engine/behavior/types";
import type { AppState } from "@/lib/types";

export function runBehaviorLoop(
  state: AppState,
  opts?: {
    interventionResponse?: Partial<Record<InterventionType, number>>;
    experiments?: BehaviorLoopResult["experiments"];
  },
): BehaviorLoopResult {
  const profile = buildBehaviorProfile(state, opts?.interventionResponse ?? {});
  const patterns = detectBehaviorPatterns(state);
  const triggers = detectBehaviorTriggers(patterns);
  const interventions = selectInterventions(triggers, profile);
  const experiments = proposeExperiments(triggers, opts?.experiments ?? []);
  const lapses = detectLapses(state, profile);
  return { profile, patterns, triggers, interventions, experiments, lapses };
}

export function applyBehaviorOutcome(
  profile: BehaviorProfile,
  type: InterventionType,
  success: boolean,
): BehaviorProfile {
  const prev = profile.interventionResponse[type] ?? 0.5;
  const next = success
    ? Math.min(0.95, prev + 0.08)
    : Math.max(0.1, prev - 0.1);
  return {
    ...profile,
    interventionResponse: {
      ...profile.interventionResponse,
      [type]: Math.round(next * 100) / 100,
    },
  };
}
