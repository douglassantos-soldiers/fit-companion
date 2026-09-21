/**
 * Pure intelligence assembly — the only caller of computeDecisions for product paths.
 * DOMAIN state → Context → Safety → Decision → Living Plan → Recommendations
 */
import { buildContextSnapshot } from "@/lib/engine/context-snapshot";
import { buildUserContext } from "@/lib/engine/context";
import { computeDecisions } from "@/lib/engine/decision";
import {
  computeLearningSnapshot,
  learningWeekHint,
  type LearningPrior,
} from "@/lib/engine/learning";
import { rankRecommendations } from "@/lib/engine/recommendation";
import { computeRecoverySnapshot } from "@/lib/engine/recovery";
import { evaluateSafetyForDate } from "@/lib/engine/safety";
import { buildWeeklyPlanDetailed, planDayForToday } from "@/lib/engine/plan";
import { materializeLivingPlan } from "@/lib/engine/living-plan-materialize";
import {
  DECISION_ENGINE_VERSION,
  fingerprintDecisionInputs,
  resolveDecisionContextForUi,
  type DecisionContextSnapshot,
  type DecisionContextSource,
} from "@/lib/engine/decision-context-snapshot";
import type { AppState } from "@/lib/types";
import { todayKey } from "@/lib/types";
import { DEFAULT_USER_TIMEZONE, normalizeUserTimezone } from "@/lib/timezone";

export type AssembleDecisionContextOpts = {
  date?: string;
  source?: DecisionContextSource;
  snapshotVersion?: number;
  customer360Version?: number | null;
  stale360?: boolean;
  timezone?: string;
  userId?: string | null;
  learningPrior?: LearningPrior;
};

export function assembleDecisionContext(
  state: AppState,
  opts: AssembleDecisionContextOpts = {},
): DecisionContextSnapshot | null {
  const profile = state.profile;
  if (!profile) return null;

  const timezone = normalizeUserTimezone(
    opts.timezone ?? profile.timezone ?? DEFAULT_USER_TIMEZONE,
  );
  const date = opts.date ?? todayKey();
  const userId = opts.userId ?? state.userId ?? "";
  const source = opts.source ?? "offline_legacy";
  const customer360Version = opts.customer360Version ?? null;
  const stale360 = opts.stale360 === true;

  const checkIn = state.dayCheckIns?.[date];
  const noEquipment = checkIn?.noEquipment === true;
  const equipment = checkIn?.equipment ?? (noEquipment ? ("casa" as const) : profile.equipment);

  const recovery = computeRecoverySnapshot(state, date);
  const learning = computeLearningSnapshot(state, date, opts.learningPrior ?? {});
  const recoveryCtx = {
    ...(recovery.sleep != null ? { sleepHours: recovery.sleep } : {}),
    ...(recovery.energy ? { energy: recovery.energy } : {}),
    sessionRpeHardStreak: recovery.hardRpeStreak,
  };

  const { days: plan } = buildWeeklyPlanDetailed(
    profile,
    state.sessions,
    equipment,
    learningWeekHint(state, date),
    {
      likedExerciseIds: state.likedExerciseIds ?? [],
      dislikedExerciseIds: state.dislikedExerciseIds ?? [],
      exercisePreferences: state.exercisePreferences,
      recoveryCtx,
    },
  );
  const day = planDayForToday(plan, new Date(`${date}T12:00:00`));
  const plannedMinutes = day?.estimatedMin ?? 0;
  const hasTrainingDay = Boolean(day);

  const context = buildContextSnapshot(state, date, userId, recovery, learning);
  if (!context) return null;

  const safety = evaluateSafetyForDate(state, date, recovery);
  const decisions = computeDecisions(context, safety, {
    plannedMinutes,
    hasTrainingDay,
  });

  const living = materializeLivingPlan({
    state,
    date,
    snapshot: context,
    safety,
    bundle: decisions,
    day,
    recovery,
    learning,
  });
  if (!living) return null;

  const userCtx = buildUserContext(state, userId);
  const recommendations = rankRecommendations({
    livingPlan: living.plan,
    safety,
    context: userCtx,
    decisions,
    goal: profile.goal,
    purchaseProductIds: state.purchaseProductIds ?? [],
    behavior: living.behavior ?? null,
    weekday: new Date(`${date}T12:00:00`).getDay(),
  });

  const inputFingerprint = fingerprintDecisionInputs({
    date,
    timezone,
    customer360Version,
    engineVersion: DECISION_ENGINE_VERSION,
    sleepHours: context.sleep.hours,
    energy: context.energy,
    availableTimeMin: context.availableTimeMin,
    equipmentProfile: context.equipment.profile,
    equipmentLimitedToday: context.equipment.limitedToday,
    acceptedTrainingMode: context.acceptedTrainingMode,
    recoveryScore: context.recovery.score,
    recoveryLevel: context.recovery.level,
    recoveryReadiness: context.recovery.readiness ?? null,
    recoveryConfidence: context.recovery.confidence ?? null,
    proteinAdherence7d: context.nutrition.proteinAdherence7d,
    plannedMinutes,
    hasTrainingDay,
    reasonSeeds: context.reasonSeeds ?? [],
    behaviorTriggers: (living.behavior?.triggers ?? []).map((t) => t.key),
    learningConfidence: learning.learningConfidence,
  });

  const snapshot: DecisionContextSnapshot = {
    userId,
    date,
    timezone,
    customer360Version,
    stale360,
    engineVersion: DECISION_ENGINE_VERSION,
    snapshotVersion: opts.snapshotVersion ?? 0,
    inputFingerprint,
    source,
    safety,
    context,
    decisions,
    recommendations,
    livingPlan: living.plan,
  };
  if (living.behavior) snapshot.behavior = living.behavior;
  return snapshot;
}

/** UI helper: consume server cache; assemble only as explicit offline_legacy fallback. */
export function decisionContextForUi(
  state: AppState,
  date = todayKey(),
): DecisionContextSnapshot | null {
  return resolveDecisionContextForUi(state, date, (s, d) =>
    assembleDecisionContext(s, { date: d, source: "offline_legacy" }),
  );
}
