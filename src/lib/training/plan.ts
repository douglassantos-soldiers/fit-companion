/**
 * Plan orchestrator — selection + recovery + progression + muscle load + prefs.
 */
import {
  EXERCISES,
  alternativesFor,
  normalizeRestrictions,
  respectsJoints,
  type Exercise,
  type MuscleGroup,
} from "@/data/exercises";
import { hitsForExercise } from "@/lib/engine/exercise-history";
import { freshnessForGroups, sortGroupsByFreshness } from "@/lib/engine/recovery";
import { analyzePlateau } from "@/lib/training/plateau";
import { isAvoided, isPreferred, migrateLegacyPrefs } from "@/lib/training/preferences";
import {
  progressionForExercise,
  roundLoad,
  weekModifier,
  type WeekMode,
} from "@/lib/training/progression";
import { buildPrescriptions, type SetPrescription } from "@/lib/training/sets";
import { maybePairSuperset } from "@/lib/training/superset";
import { matchesInventory } from "@/lib/training/inventory";
import { withWarmupPrescriptions } from "@/lib/training/warmup";
import { resolveTrainingWeekdays } from "@/lib/training/weekdays";
import { getTrainingRules } from "@/lib/training/training-rules";
import type { AppState, ExercisePreferenceValue, FocusMuscle, Profile, SessionLog } from "@/lib/types";

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  suggestedLoad: number;
  unit: Exercise["unit"];
  reason?: string;
  recoveryOk?: boolean;
  lastPerformance?: string | null;
  plateau?: boolean;
  swappedFromId?: string;
  prescriptions?: SetPrescription[];
  estimated1rm?: number;
  bestWeight?: number;
  reasonCodes?: string[];
  confidence?: number;
  supersetGroupId?: string;
}

export interface PlannedDay {
  id: string;
  weekday: number;
  title: string;
  focus: string;
  estimatedMin: number;
  exercises: PlannedExercise[];
  recoveryScore?: number;
}

export interface WeeklyPlanResult {
  days: PlannedDay[];
  weekMode: WeekMode;
  plateauCount: number;
}

export interface ExercisePrefs {
  likedExerciseIds?: string[];
  dislikedExerciseIds?: string[];
  exercisePreferences?: Record<string, ExercisePreferenceValue>;
}

function activeSplits() {
  return getTrainingRules().splits;
}

function sortGroupsForPlan(groups: MuscleGroup[], sessions: SessionLog[], focus?: FocusMuscle[]) {
  const ordered = sortGroupsByFreshness(groups, sessions);
  if (!focus?.length) return ordered;
  const focusSet = new Set(focus);
  return [...ordered].sort((a, b) => Number(focusSet.has(b as FocusMuscle)) - Number(focusSet.has(a as FocusMuscle)));
}

function activeGoalScheme() {
  return getTrainingRules().goalScheme;
}

function activeLevelFactor() {
  return getTrainingRules().levelFactor;
}

function resolvePrefs(prefs: ExercisePrefs): Record<string, ExercisePreferenceValue> {
  if (prefs.exercisePreferences && Object.keys(prefs.exercisePreferences).length) {
    return prefs.exercisePreferences;
  }
  return migrateLegacyPrefs({
    likedExerciseIds: prefs.likedExerciseIds ?? [],
    dislikedExerciseIds: prefs.dislikedExerciseIds ?? [],
    exercisePreferences: {},
  });
}

function prefScore(ex: Exercise, prefMap: Record<string, ExercisePreferenceValue>): number {
  if (isAvoided(prefMap, ex.id)) return 1000;
  if (isPreferred(prefMap, ex.id)) return -10;
  return ex.priority ?? 99;
}

function pickExercises(
  groups: MuscleGroup[],
  equipment: Profile["equipment"],
  restrictions: string[],
  count: number,
  sessions: SessionLog[],
  prefMap: Record<string, ExercisePreferenceValue>,
  inventory?: Profile["equipmentInventory"],
  focusMuscles?: FocusMuscle[],
) {
  const avoided = normalizeRestrictions(restrictions);
  const orderedGroups = sortGroupsForPlan(groups, sessions, focusMuscles);
  const available = EXERCISES.filter(
    (e) =>
      matchesInventory(e, equipment, inventory) &&
      respectsJoints(e, avoided) &&
      !isAvoided(prefMap, e.id),
  ).sort((a, b) => prefScore(a, prefMap) - prefScore(b, prefMap));

  const fallbackPool = EXERCISES.filter(
    (e) => matchesInventory(e, equipment, inventory) && respectsJoints(e, avoided),
  ).sort((a, b) => prefScore(a, prefMap) - prefScore(b, prefMap));

  const pool = available.length >= count ? available : fallbackPool;
  const picked: Exercise[] = [];
  let round = 0;
  while (picked.length < count && round < 5) {
    for (const group of orderedGroups) {
      const candidate = pool.find((e) => e.group === group && !picked.includes(e));
      if (candidate) picked.push(candidate);
      if (picked.length >= count) break;
    }
    if (picked.length < count) {
      const any = pool.find((e) => !picked.includes(e));
      if (any) picked.push(any);
      else break;
    }
    round += 1;
  }
  return picked;
}

function maybeSwapForPlateau(
  ex: Exercise,
  equipment: Profile["equipment"],
  restrictions: string[],
  sessions: SessionLog[],
  prefMap: Record<string, ExercisePreferenceValue>,
  alreadyPicked: Set<string>,
): { exercise: Exercise; swappedFromId?: string } {
  const plateau = analyzePlateau(hitsForExercise(ex.id, sessions));
  if (!plateau.plateau || plateau.suggested_action !== "change_exercise") {
    return { exercise: ex };
  }
  const alts = alternativesFor(ex.id, equipment, restrictions).filter(
    (a) =>
      !alreadyPicked.has(a.id) &&
      !isAvoided(prefMap, a.id) &&
      !analyzePlateau(hitsForExercise(a.id, sessions)).plateau,
  );
  alts.sort((a, b) => prefScore(a, prefMap) - prefScore(b, prefMap));
  const swap = alts[0];
  if (!swap) return { exercise: ex };
  return { exercise: swap, swappedFromId: ex.id };
}

export function buildWeeklyPlan(
  profile: Profile,
  sessions: SessionLog[] = [],
  learningHint?: WeekMode | null,
  prefs?: ExercisePrefs,
): PlannedDay[] {
  return buildWeeklyPlanDetailed(profile, sessions, undefined, learningHint, prefs).days;
}

export function buildWeeklyPlanFromState(
  state: AppState,
  equipmentOverride?: Profile["equipment"],
  learningHint?: WeekMode | null,
): WeeklyPlanResult | null {
  if (!state.profile) return null;
  return buildWeeklyPlanDetailed(
    state.profile,
    state.sessions,
    equipmentOverride,
    learningHint,
    {
      likedExerciseIds: state.likedExerciseIds,
      dislikedExerciseIds: state.dislikedExerciseIds,
      exercisePreferences: state.exercisePreferences,
    },
  );
}

export function buildWeeklyPlanDetailed(
  profile: Profile,
  sessions: SessionLog[] = [],
  equipmentOverride?: Profile["equipment"],
  learningHint?: WeekMode | null,
  prefs: ExercisePrefs = {},
): WeeklyPlanResult {
  const weekdays = resolveTrainingWeekdays(profile);
  const days = weekdays.length;
  const splits = activeSplits();
  const split = splits[days] ?? splits[3]!;
  const scheme = activeGoalScheme()[profile.goal];
  const equipment = equipmentOverride ?? profile.equipment;
  const inventory = profile.equipmentInventory;
  const focusMuscles = profile.focusMuscles;
  const mode = weekModifier(sessions, 7, learningHint ?? null);
  const prefMap = resolvePrefs(prefs);
  let plateauCount = 0;

  const planned = split!.map((block, i) => {
    const recoveryScore = freshnessForGroups(block.groups, sessions);
    const recoveryOk = recoveryScore >= 35;
    const extraFocus = focusMuscles?.some((m) => block.groups.includes(m as MuscleGroup)) ? 1 : 0;
    const count = (profile.goal === "performance" ? 4 : 5) + extraFocus;
    const volumeFactor = recoveryOk ? 1 : 0.75;

    const rawPicked = pickExercises(
      block.groups,
      equipment,
      profile.restrictions,
      count,
      sessions,
      prefMap,
      inventory,
      focusMuscles,
    );

    const already = new Set<string>();
    const exercises = rawPicked.map((raw) => {
      const { exercise: ex, swappedFromId } = maybeSwapForPlateau(
        raw,
        equipment,
        profile.restrictions,
        sessions,
        prefMap,
        already,
      );
      already.add(ex.id);

      const base = ex.baseLoad * activeLevelFactor()[profile.level] * scheme.loadFactor;
      const baseSets = Math.max(2, Math.round((ex.group === "cardio" ? 1 : scheme.sets) * volumeFactor));
      const baseReps = ex.group === "cardio" ? "15 min" : ex.unit === "min" ? "45 s" : scheme.reps;
      const prog = progressionForExercise(
        ex,
        roundLoad(base),
        baseSets,
        baseReps,
        scheme.restSec,
        profile.goal,
        sessions,
        mode,
      );

      if (prog.plateau || swappedFromId) plateauCount += 1;

      let reason = prog.reason;
      if (swappedFromId) {
        const fromName = EXERCISES.find((e) => e.id === swappedFromId)?.name ?? swappedFromId;
        reason = `Swap por plateau (${fromName}) · ${reason}`;
      }

      const sets = ex.group === "cardio" || ex.unit === "min" ? 1 : prog.sets;
      const workingRx = buildPrescriptions(sets, prog.reps, prog.load, prog.restSec);
      const prescriptions =
        ex.unit === "kg" && prog.load >= 20 ? withWarmupPrescriptions(workingRx) : workingRx;

      return {
        exerciseId: ex.id,
        name: ex.name,
        sets,
        reps: prog.reps,
        restSec: prog.restSec,
        suggestedLoad: prog.load,
        unit: ex.unit,
        reason,
        recoveryOk,
        lastPerformance: prog.lastPerformance,
        plateau: prog.plateau || Boolean(swappedFromId),
        prescriptions,
        ...(prog.evidence.estimated1rm != null ? { estimated1rm: prog.evidence.estimated1rm } : {}),
        ...(prog.evidence.lastLoad != null ? { bestWeight: prog.evidence.lastLoad } : {}),
        reasonCodes: prog.reasonCodes,
        confidence: prog.confidence,
        ...(swappedFromId ? { swappedFromId } : {}),
      } satisfies PlannedExercise;
    });

    const paired = maybePairSuperset(exercises);

    return {
      id: `dia-${i + 1}`,
      weekday: weekdays![i] ?? 1,
      title: recoveryOk ? block.title : `${block.title} (leve)`,
      focus: recoveryOk ? block.focus : `${block.focus} · recuperação baixa`,
      estimatedMin: 20 + paired.length * (scheme.restSec > 100 ? 9 : 7),
      exercises: paired,
      recoveryScore,
    } satisfies PlannedDay;
  });

  return { days: planned, weekMode: mode, plateauCount };
}

export { roundLoad, weekModifier };
export type { WeekMode };

export function planDayForToday(plan: PlannedDay[], date = new Date()) {
  const weekday = date.getDay();
  return plan.find((d) => d.weekday === weekday) ?? null;
}

export function sessionVolume(exercises: SessionLog["exercises"]) {
  return exercises.reduce(
    (total, ex) =>
      total +
      ex.sets.reduce(
        (sum, s) =>
          s.done && !s.skipped ? sum + s.reps * (s.weightKg || bodyLoad(ex.exerciseId)) : sum,
        0,
      ),
    0,
  );
}

function bodyLoad(exerciseId: string) {
  const ex = EXERCISES.find((e) => e.id === exerciseId);
  return ex && ex.unit !== "kg" ? 10 : 0;
}

export function buildExpressSession(day: PlannedDay): PlannedDay {
  const compounds = day.exercises.filter((e) => e.sets >= 3).slice(0, 4);
  const base = compounds.length ? compounds : day.exercises.slice(0, 3);
  const exercises = base.map((ex) => ({
    ...ex,
    sets: Math.max(1, Math.ceil(ex.sets * 0.5)),
    restSec: Math.min(ex.restSec, 60),
    reason: "Express · protege streak",
  }));
  return {
    ...day,
    id: `${day.id}-express`,
    title: `${day.title} · Express`,
    focus: `Express · ${day.focus}`,
    estimatedMin: Math.min(12, Math.max(8, 6 + exercises.length * 2)),
    exercises,
  };
}
