/**
 * Behavior patterns — persistent-shaped objects from AppState evidence.
 */
import {
  fridayTrainingGaps,
  mealLoggingDropDays,
  lowSleepStreakDays,
} from "@/lib/engine/behavior/adherence";
import type {
  BehaviorEvidence,
  BehaviorPattern,
  BehaviorPatternKey,
} from "@/lib/engine/behavior/types";
import { extractUserPatterns } from "@/lib/engine/user-patterns";
import {
  extractLearnedPatterns,
  activePatterns,
  type LearnedPattern,
} from "@/lib/engine/learned-patterns";
import { todayKey, type AppState } from "@/lib/types";

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function pattern(
  key: BehaviorPatternKey,
  description: string,
  evidence: BehaviorEvidence[],
  supportCount: number,
  confidence: number,
  first: string,
  last: string,
): BehaviorPattern {
  return {
    key,
    description,
    evidence: evidence.slice(0, 8),
    confidence: Math.max(0, Math.min(0.95, confidence)),
    supportCount,
    firstObservedAt: first,
    lastObservedAt: last,
    status: supportCount >= 2 && confidence >= 0.55 ? "active" : "candidate",
  };
}

export function detectBehaviorPatterns(
  state: AppState,
  now = todayKey(),
  learnedPrior?: LearnedPattern[] | null,
): BehaviorPattern[] {
  const legacy = extractUserPatterns(state);
  const out: BehaviorPattern[] = [];

  if (legacy.weakestWeekday != null && state.sessions.length >= 8) {
    const wd = legacy.weakestWeekday;
    const count = legacy.weekdaySessionCounts[wd] ?? 0;
    const avg = Object.values(legacy.weekdaySessionCounts).reduce((a, b) => a + b, 0) / 7;
    const support = Math.max(2, Math.round(avg - count + 2));
    const conf = Math.min(0.9, 0.4 + (avg - count) * 0.15);
    out.push(
      pattern(
        "weak_weekday",
        `Treina menos na ${WEEKDAY_NAMES[wd]}`,
        [{ date: now, note: `weekday=${wd} count=${count} avg=${avg.toFixed(1)}` }],
        support,
        conf,
        now,
        now,
      ),
    );
    if (wd === 5) {
      out.push(
        pattern(
          "low_friday_training",
          "Baixa aderência de treino nas sextas",
          [{ date: now, note: `friday_sessions=${count}` }],
          support,
          conf,
          now,
          now,
        ),
      );
    }
  }

  const fri = fridayTrainingGaps(state);
  if (fri.count >= 2) {
    out.push(
      pattern(
        "low_friday_training",
        "Sextas sem treino recorrentes",
        fri.evidenceDates.map((d) => ({ date: d, note: "friday_miss" })),
        fri.count,
        Math.min(0.9, 0.45 + fri.count * 0.08),
        fri.evidenceDates[fri.evidenceDates.length - 1] ?? now,
        fri.evidenceDates[0] ?? now,
      ),
    );
  }

  if (legacy.mealGapWeekend) {
    out.push(
      pattern(
        "weekend_meal_gap",
        "Menos refeições registradas no fim de semana",
        [{ date: now, note: "weekend_meal_gap" }],
        3,
        0.7,
        now,
        now,
      ),
    );
  }

  if (legacy.longWorkoutAvoidance) {
    out.push(
      pattern(
        "long_workout_avoidance",
        "Prefere concluir treinos mais curtos",
        [{ date: now, note: "long_workout_avoidance" }],
        3,
        0.72,
        now,
        now,
      ),
    );
  }

  const drop = mealLoggingDropDays(state);
  if (drop.length >= 2) {
    out.push(
      pattern(
        "meal_logging_drop",
        "Quedas no logging de refeições após dias com registro",
        drop.slice(0, 5).map((d) => ({ date: d, note: "meal_logging_drop" })),
        drop.length,
        Math.min(0.88, 0.4 + drop.length * 0.08),
        drop[drop.length - 1] ?? now,
        drop[0] ?? now,
      ),
    );
  }

  const sleepDays = lowSleepStreakDays(state);
  if (sleepDays.length >= 2) {
    out.push(
      pattern(
        "sleep_debt",
        "Sequência de noites com sono < 6h",
        sleepDays.map((d) => ({ date: d, note: "sleep_lt_6" })),
        sleepDays.length,
        Math.min(0.9, 0.5 + sleepDays.length * 0.1),
        sleepDays[sleepDays.length - 1] ?? now,
        sleepDays[0] ?? now,
      ),
    );
  }

  // Bridge learned patterns
  try {
    const learned = activePatterns(extractLearnedPatterns(state, learnedPrior ?? null, now));
    for (const lp of learned) {
      const key = mapLearnedKind(lp.kind);
      if (!key || out.some((p) => p.key === key)) continue;
      out.push(
        pattern(
          key,
          `Padrão aprendido: ${lp.kind}`,
          lp.evidence.map((e) => ({ date: e.date, note: e.note })),
          Math.max(lp.evidenceCount, lp.minObservations),
          lp.confidence,
          lp.evidence[0]?.date ?? lp.lastObservedAt,
          lp.lastObservedAt,
        ),
      );
    }
  } catch {
    /* optional */
  }

  // Dedupe by key keeping higher confidence
  const byKey = new Map<BehaviorPatternKey, BehaviorPattern>();
  for (const p of out) {
    const prev = byKey.get(p.key);
    if (!prev || p.confidence > prev.confidence) byKey.set(p.key, p);
  }
  return [...byKey.values()];
}

function mapLearnedKind(kind: string): BehaviorPatternKey | null {
  switch (kind) {
    case "weekday_skip":
      return "weekday_skip";
    case "avoids_long_workouts":
      return "long_workout_avoidance";
    case "weekend_protein_drop":
    case "sunday_meal_gap":
      return "weekend_meal_gap";
    case "prefers_short_sessions":
      return "prefers_short_sessions";
    case "volume_reduction_helps":
      return "volume_reduction_helps";
    default:
      return null;
  }
}

export function activeBehaviorPatterns(patterns: BehaviorPattern[]): BehaviorPattern[] {
  return patterns.filter(
    (p) =>
      (p.status === "active" || (p.supportCount >= 2 && p.confidence >= 0.55)) &&
      p.status !== "decayed",
  );
}
