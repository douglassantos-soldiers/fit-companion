import { weeklyReviewWorkflow } from "@/lib/coach/workflows/weekly-review";
import type { CoachContext } from "@/lib/coach/types";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { buildCustomer360FromState } from "@/lib/customer360";
import { exerciseById } from "@/data/exercises";
import { sessionsInLastDays, streak, weekOverWeek } from "@/lib/engine/dimensions";
import { trainingAdherence7d } from "@/lib/engine/behavior/adherence";
import { consecutiveHardRpeStreak } from "@/lib/engine/recovery";
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { computeLearningInsights } from "@/lib/engine/learning";
import { isoWeekDateKeys } from "@/lib/engine/xp";
import { hitsForExercise, listExercisesWithHistory } from "@/lib/engine/exercise-history";
import { best1RM } from "@/lib/training/one-rm";
import { currentPersonalRecords, detectExercisePrs } from "@/lib/training/prs";
import { computeStrengthScore } from "@/lib/training/strength-score";
import { resolveTrainingPlanDays } from "@/lib/training/resolve-plan-days";
import { GOAL_LABEL, LEVEL_LABEL, todayKey, type AppState, type SessionLog } from "@/lib/types";

export type PeriodKind = "week" | "month";

export interface NextBlockDay {
  title: string;
  focus: string;
  exerciseCount: number;
}

export interface NextBlockPreview {
  label: string;
  days: NextBlockDay[];
}

export interface PeriodReview {
  kind: PeriodKind;
  label: string;
  sessions: number;
  volumeKg: number;
  prCount: number;
  consistencyPct: number;
  adherencePct: number;
  volumeDeltaPct: number | null;
  strengthScore: number | null;
  strengthDelta: number | null;
  nextBlock: NextBlockPreview | null;
  isSundayRitual: boolean;
  bestEvolution: { exerciseId: string; name: string; deltaKg: number } | null;
  coachLine: string;
  wins: string[];
  risks: string[];
  start: string;
  end: string;
}

function monthRange(now = new Date()): { start: string; end: string; label: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase();
  return { start: todayKey(start), end: todayKey(end), label };
}

function isSunday(now: Date) {
  return now.getDay() === 0;
}

function weekRange(now = new Date()): { start: string; end: string; label: string } {
  const keys = isoWeekDateKeys(now);
  const start = keys[0]!;
  const end = keys[6]!;
  const label = isSunday(now) ? "RITUAL DA SEMANA" : "SEU RESUMO";
  return { start, end, label };
}

function inRange(session: SessionLog, start: string, end: string) {
  const d = session.date.slice(0, 10);
  return d >= start && d <= end;
}

function bestEvolution(sessions: SessionLog[], start: string, end: string) {
  const period = sessions.filter((s) => inRange(s, start, end));
  const prior = sessions.filter((s) => s.date.slice(0, 10) < start);
  let best: { exerciseId: string; name: string; deltaKg: number } | null = null;
  const ids = new Set(period.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
  for (const exerciseId of ids) {
    const prs = detectExercisePrs(exerciseId, [...period, ...prior]).filter(
      (p) => p.prType === "WEIGHT_PR" && p.achievedAt.slice(0, 10) >= start && p.achievedAt.slice(0, 10) <= end,
    );
    const hit = prs[prs.length - 1];
    if (!hit || hit.previousValue == null) continue;
    const deltaKg = Math.round((hit.value - hit.previousValue) * 10) / 10;
    if (deltaKg <= 0) continue;
    if (!best || deltaKg > best.deltaKg) {
      best = {
        exerciseId,
        name: exerciseById(exerciseId)?.name ?? exerciseId,
        deltaKg,
      };
    }
  }
  return best;
}

function nextWeekPlan(state: AppState, now: Date): NextBlockPreview | null {
  const profile = state.profile;
  if (!profile) return null;
  const nextMonday = new Date(now);
  const day = (nextMonday.getDay() + 6) % 7;
  nextMonday.setDate(nextMonday.getDate() - day + 7);
  nextMonday.setHours(12, 0, 0, 0);

  const nextKey = todayKey(nextMonday);
  const plan = resolveTrainingPlanDays(state, nextKey);
  if (!plan.length) return null;

  const weekKeys = isoWeekDateKeys(nextMonday);
  const label = state.activeTrainingBlock
    ? `Próxima semana da trilha · ${weekKeys[0]!.slice(5)} → ${weekKeys[6]!.slice(5)}`
    : state.activeTrainingPlanId
      ? `Próxima rotina · ${weekKeys[0]!.slice(5)} → ${weekKeys[6]!.slice(5)}`
      : `Próximo bloco · ${weekKeys[0]!.slice(5)} → ${weekKeys[6]!.slice(5)}`;

  return {
    label,
    days: plan.map((d) => ({
      title: d.title,
      focus: d.focus,
      exerciseCount: d.exercises.length,
    })),
  };
}

/** Full coach context for period review — replaces the former stub. */
function buildPeriodCoachContext(state: AppState): CoachContext {
  const date = todayKey();
  const p = state.profile;
  const sessions7d = sessionsInLastDays(state.sessions, 7).length;
  const prs = currentPersonalRecords(state.sessions).slice(0, 5);
  const top1rm = listExercisesWithHistory(state.sessions, 8)
    .map((h) => {
      const best = best1RM(hitsForExercise(h.exerciseId, state.sessions));
      if (!best) return null;
      return { exerciseId: h.exerciseId, estimated1rm: best.value };
    })
    .filter((x): x is { exerciseId: string; estimated1rm: number } => Boolean(x))
    .sort((a, b) => b.estimated1rm - a.estimated1rm)
    .slice(0, 5);

  const decision =
    state.decisionContextByDate?.[date] ??
    (p ? assembleDecisionContext(state, { date, source: "offline_legacy" }) : null);
  const living = decision?.livingPlan ?? state.livingPlans?.[date] ?? null;
  const checkIn = state.dayCheckIns?.[date];
  const insights = p ? computeLearningInsights(state) : null;
  const goals = p ? nutritionGoals(p, insights) : null;
  const totals = dayNutritionTotals(state.meals ?? [], date);
  const c360 = buildCustomer360FromState(
    state,
    state.userId != null ? { userId: state.userId, date } : { date },
  );
  const hardStreak = consecutiveHardRpeStreak(state.sessions);
  const safety = decision?.safety;

  return {
    userId: state.userId ?? "local",
    date,
    profile: p
      ? {
          name: p.name,
          goal: GOAL_LABEL[p.goal],
          level: LEVEL_LABEL[p.level],
          weightKg: p.weightKg,
          daysPerWeek: p.daysPerWeek,
          equipment: p.equipment,
          restrictions: p.restrictions,
          ...(p.primaryBlocker ? { primaryBlocker: p.primaryBlocker } : {}),
        }
      : null,
    goals: goals
      ? {
          proteinG: goals.proteinG,
          kcal: goals.kcal,
          waterMl: goals.waterMl,
        }
      : null,
    training: {
      streak: streak(state.sessions, { freezeUsedDates: state.freezeUsedDates }),
      sessions7d,
      sessions28d: sessionsInLastDays(state.sessions, 28).length,
      todayMode: living?.workout.mode ?? null,
      todayTitle: living?.workout.title ?? null,
      volumeFactor: living?.workout.volumeFactor ?? null,
      lastSessionDate: state.sessions[0]?.date.slice(0, 10) ?? null,
      lastSessionRpe: state.sessions[0]?.rpe ?? null,
    },
    exercisePerformance: {
      recentPrs: prs.map((pr) => ({ label: pr.label, value: pr.value, date: pr.achievedAt })),
      top1rm,
    },
    recovery: {
      level: c360.recovery.level ?? (living?.traffic.recovery === "green" ? "recovered" : living?.traffic.recovery === "red" ? "low" : "moderate"),
      score: c360.recovery.recoveryScore,
      sleepHours: checkIn?.sleepHours ?? null,
      energy: checkIn?.energy ?? null,
      hardRpeStreak: hardStreak,
    },
    nutrition: {
      proteinG: totals.proteinG,
      carbG: totals.carbG ?? 0,
      fatG: totals.fatG ?? 0,
      kcal: totals.kcal,
      mealsLogged: totals.count,
      proteinTarget: goals?.proteinG ?? null,
      loggingConfidence: null,
    },
    supplements: { routineIds: state.supplementRoutine ?? [], adherence30d: null },
    behavior: {
      workouts7d: sessions7d,
      meals7d: (state.meals ?? []).filter((m) => {
        const d = m.date.slice(0, 10);
        const limit = new Date();
        limit.setDate(limit.getDate() - 6);
        return d >= todayKey(limit);
      }).length,
      coachMessages: state.chat?.length ?? 0,
    },
    customer360: {
      nutritionAdherence: c360.nutrition.proteinAdherence7d,
      recoveryScore: c360.recovery.recoveryScore,
      performanceScore: c360.performance.sessions28d,
    },
    todayDecisions:
      decision?.decisions.decisions.map((d) => ({
        type: d.decisionType,
        value: String(d.decisionValue),
        reasonCodes: d.reasonCodes,
        confidence: d.confidence,
        explanation: d.explanation,
        source: "server_snapshot" as const,
      })) ?? [],
    recentDecisions: [],
    userPatterns: [],
    safety: {
      escalateCare: Boolean(safety?.escalateCare),
      blockStims: Boolean(safety?.blockStims),
      preferLightTraining: Boolean(safety?.preferLightTraining),
      flags: safety?.flags ?? [],
      reasons: safety?.reasons ?? [],
    },
    memory: [],
    livingSummary: living?.narrative ?? "",
    why: living?.why ?? [],
    reasonCodes: living?.whyByChange?.map((w) => w.key) ?? [],
  };
}

export function periodReview(state: AppState, kind: PeriodKind, now = new Date()): PeriodReview {
  const range = kind === "week" ? weekRange(now) : monthRange(now);
  const inPeriod = state.sessions.filter((s) => inRange(s, range.start, range.end));
  const volumeKg = Math.round(inPeriod.reduce((sum, s) => sum + s.volumeKg, 0));
  const prs = currentPersonalRecords(state.sessions).filter((p) => {
    const d = p.achievedAt.slice(0, 10);
    return d >= range.start && d <= range.end;
  });
  const planned = Math.max(1, (state.profile?.daysPerWeek ?? 3) * (kind === "week" ? 1 : 4));
  const consistencyPct = Math.min(100, Math.round((inPeriod.length / planned) * 100));
  const adherencePct =
    kind === "week"
      ? Math.round(trainingAdherence7d(state) * 100)
      : consistencyPct;
  const wow = weekOverWeek(state.sessions);
  const volumeDeltaPct = kind === "week" ? wow.volumeDeltaPct : null;
  const coach = weeklyReviewWorkflow(buildPeriodCoachContext(state));
  const best = bestEvolution(state.sessions, range.start, range.end);
  const strength = computeStrengthScore(state.sessions, state.profile, now);
  const sundayRitual = kind === "week" && isSunday(now);

  return {
    kind,
    label: range.label,
    sessions: inPeriod.length,
    volumeKg,
    prCount: prs.length,
    consistencyPct,
    adherencePct,
    volumeDeltaPct,
    strengthScore: strength.score,
    strengthDelta: strength.delta28d,
    nextBlock: kind === "week" ? nextWeekPlan(state, now) : null,
    isSundayRitual: sundayRitual,
    bestEvolution: best,
    coachLine: coach.nextFocus ?? coach.wins?.[0] ?? "Continue registrando.",
    wins: coach.wins ?? [],
    risks: coach.risks ?? [],
    start: range.start,
    end: range.end,
  };
}

export function prsAchievedInSession(session: SessionLog, priorSessions: SessionLog[]) {
  const all = [session, ...priorSessions];
  const ids = new Set(session.exercises.map((e) => e.exerciseId));
  const out = [];
  for (const exerciseId of ids) {
    for (const pr of detectExercisePrs(exerciseId, all)) {
      if (pr.sessionId === session.id) out.push(pr);
    }
  }
  return out;
}
