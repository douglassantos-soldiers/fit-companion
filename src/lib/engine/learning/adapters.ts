/**
 * Adapters: LearnedPattern / BehaviorPattern → LearningPattern; preferences from evidence.
 */
import type { BehaviorPattern } from "@/lib/engine/behavior/types";
import type { LearnedPattern, PatternKind } from "@/lib/engine/learned-patterns";
import type {
  LearningDomain,
  LearningEvidence,
  LearningPattern,
  UserPreference,
} from "@/lib/engine/learning/types";

const LEARNED_DOMAIN: Record<PatternKind, LearningDomain> = {
  weekday_skip: "training",
  avoids_long_workouts: "training",
  prefers_short_sessions: "training",
  weekend_protein_drop: "nutrition",
  sunday_meal_gap: "nutrition",
  poor_sleep_after_late_train: "recovery",
  volume_reduction_helps: "recovery",
};

const BEHAVIOR_DOMAIN: Record<string, LearningDomain> = {
  weak_weekday: "training",
  weekday_skip: "training",
  long_workout_avoidance: "training",
  prefers_short_sessions: "training",
  low_friday_training: "training",
  weekend_meal_gap: "nutrition",
  meal_logging_drop: "nutrition",
  sleep_debt: "recovery",
  volume_reduction_helps: "recovery",
};

function toEvidence(date: string, note: string): LearningEvidence {
  return { date, source: "outcome", note };
}

export function learnedToLearningPattern(p: LearnedPattern): LearningPattern {
  return {
    domain: LEARNED_DOMAIN[p.kind] ?? "behavior",
    key: p.kind,
    status: p.status,
    supportCount: p.evidenceCount,
    confidence: p.confidence,
    evidence: p.evidence.map((e) => toEvidence(e.date, e.note)),
    successfulOutcomes: p.successfulOutcomes,
    failedOutcomes: p.failedOutcomes,
    lastObservedAt: p.lastObservedAt,
  };
}

export function behaviorToLearningPattern(p: BehaviorPattern): LearningPattern {
  return {
    domain: BEHAVIOR_DOMAIN[p.key] ?? "behavior",
    key: p.key,
    status: p.status === "decayed" ? "decayed" : p.status === "active" ? "active" : "candidate",
    supportCount: p.supportCount,
    confidence: p.confidence,
    evidence: p.evidence.map((e) => toEvidence(e.date, e.note)),
    successfulOutcomes: 0,
    failedOutcomes: 0,
    lastObservedAt: p.lastObservedAt,
  };
}

export function mergeCanonicalPatterns(
  learned: LearnedPattern[],
  behavior: BehaviorPattern[],
): LearningPattern[] {
  const map = new Map<string, LearningPattern>();
  for (const p of behavior) {
    map.set(p.key, behaviorToLearningPattern(p));
  }
  for (const p of learned) {
    const mapped = learnedToLearningPattern(p);
    const prev = map.get(mapped.key);
    if (!prev || mapped.confidence >= prev.confidence) map.set(mapped.key, mapped);
  }
  return [...map.values()];
}

export function deriveUserPreferences(learned: LearnedPattern[]): UserPreference[] {
  const out: UserPreference[] = [];
  const short = learned.find((p) => p.kind === "prefers_short_sessions" && p.status === "active");
  if (short && short.successfulOutcomes >= 2) {
    out.push({
      key: "express_preferred_when_time_low",
      label: "Sessões curtas têm melhor aderência quando o tempo é curto",
      sourcePattern: short.kind,
      strength: short.confidence,
    });
  }
  const vol = learned.find((p) => p.kind === "volume_reduction_helps" && p.status === "active");
  if (vol && vol.successfulOutcomes >= 2) {
    out.push({
      key: "volume_reduction_helps_when_fatigued",
      label: "Redução de volume ajudou em dias de baixa recuperação",
      sourcePattern: vol.kind,
      strength: vol.confidence,
    });
  }
  return out;
}

export function averageLearningConfidence(patterns: LearningPattern[]): number {
  const active = patterns.filter((p) => p.status === "active");
  if (!active.length) return 0.4;
  const avg = active.reduce((s, p) => s + p.confidence, 0) / active.length;
  return Math.round(avg * 1000) / 1000;
}
