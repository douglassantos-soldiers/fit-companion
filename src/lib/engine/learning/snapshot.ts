/**
 * Authoritative Learning snapshot for a calendar date.
 * Learns only from persisted evidence. Not a psychological diagnosis.
 */
import { buildBehaviorProfile } from "@/lib/engine/behavior/profile";
import { detectBehaviorPatterns } from "@/lib/engine/behavior/patterns";
import { detectBehaviorTriggers } from "@/lib/engine/behavior/triggers";
import { selectInterventions } from "@/lib/engine/behavior/interventions";
import { detectLapses } from "@/lib/engine/behavior/relapse";
import { extractLearnedPatterns } from "@/lib/engine/learned-patterns";
import { extractLearningEvidence } from "@/lib/engine/learning/evidence";
import {
  experimentLinkedIntervention,
  resolveExperiments,
} from "@/lib/engine/learning/experiments";
import { computeLearningInsights } from "@/lib/engine/learning/insights";
import { applyInterventionOutcome, scalarsFromResponses } from "@/lib/engine/learning/responses";
import {
  averageLearningConfidence,
  deriveUserPreferences,
  mergeCanonicalPatterns,
} from "@/lib/engine/learning/adapters";
import type {
  LearningPrior,
  LearningSnapshot,
  InterventionResponse,
} from "@/lib/engine/learning/types";
import { todayKey, type AppState } from "@/lib/types";

export function computeLearningSnapshot(
  state: AppState,
  date = todayKey(),
  prior: LearningPrior = {},
): LearningSnapshot {
  const insights = computeLearningInsights(state, date);
  const learnedPatterns = extractLearnedPatterns(state, prior.patterns ?? null, date);
  let interventionResponses: InterventionResponse[] = [...(prior.interventionResponses ?? [])];
  const behaviorPatterns = detectBehaviorPatterns(state, date, learnedPatterns);
  const triggers = detectBehaviorTriggers(behaviorPatterns);
  const experiments = resolveExperiments(state, triggers, prior.experiments, date);

  for (const exp of experiments) {
    if (exp.status !== "completed" || exp.result == null) continue;
    const already = interventionResponses.some(
      (r) => r.lastUsedAt === exp.end && r.type === experimentLinkedIntervention(exp),
    );
    if (already) continue;
    const type = experimentLinkedIntervention(exp);
    const result = exp.result >= exp.baseline ? "success" : "fail";
    interventionResponses = applyInterventionOutcome(interventionResponses, type, result, exp.end);
  }

  const rankedProfile = buildBehaviorProfile(state, scalarsFromResponses(interventionResponses));
  const rankedInterventions = selectInterventions(triggers, rankedProfile);
  const lapses = detectLapses(state, rankedProfile, date);
  const behavior = {
    profile: rankedProfile,
    patterns: behaviorPatterns,
    triggers,
    interventions: rankedInterventions,
    experiments,
    lapses,
  };
  const patterns = mergeCanonicalPatterns(learnedPatterns, behaviorPatterns);
  const preferences = deriveUserPreferences(learnedPatterns);

  return {
    date,
    insights,
    evidence: extractLearningEvidence(state, date),
    learnedPatterns,
    patterns,
    behavior,
    interventionResponses,
    experiments,
    preferences,
    learningConfidence: averageLearningConfidence(patterns),
  };
}
