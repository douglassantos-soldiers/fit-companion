/**
 * Hybrid training block — prescribed structure; Living Plan still owns mode/volume.
 */
import { EXERCISES } from "@/data/exercises";
import { parseProgramTraining } from "@/lib/content/program-training";
import type { ContentProgram, ProgramSession } from "@/lib/content/types";
import type { PlannedDay, PlannedExercise } from "@/lib/training/plan";
import { resolveTrainingWeekdays } from "@/lib/training/weekdays";
import type {
  ActiveTrainingBlock,
  ArchivedTrainingBlock,
  BlockDayPrescription,
  BlockWeek,
  Profile,
} from "@/lib/types";
import { todayKey } from "@/lib/types";

export const TRAINING_BLOCK_HISTORY_CAP = 8;
export const BLOCK_DURATION_MIN = 4;
export const BLOCK_DURATION_MAX = 8;

export function clampBlockDurationWeeks(weeks: number): number {
  const n = Math.round(Number(weeks) || BLOCK_DURATION_MIN);
  return Math.min(BLOCK_DURATION_MAX, Math.max(BLOCK_DURATION_MIN, n));
}

function parseYmd(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T12:00:00`);
}

function daysBetween(startYmd: string, dateYmd: string): number {
  const a = parseYmd(startYmd).getTime();
  const b = parseYmd(dateYmd).getTime();
  return Math.floor((b - a) / 86_400_000);
}

/** 0-based week index from calendar start, clamped to duration. */
export function blockWeekIndex(block: ActiveTrainingBlock, date = todayKey()): number {
  const elapsed = daysBetween(block.startDate, date);
  if (elapsed < 0) return 0;
  return Math.min(block.durationWeeks - 1, Math.floor(elapsed / 7));
}

/** Soft deload bias for last 1–2 weeks when Learning has no override. */
export function blockPhaseWeekHint(
  block: ActiveTrainingBlock | null | undefined,
  date = todayKey(),
): "deload" | null {
  if (!block) return null;
  const idx = blockWeekIndex(block, date);
  const remaining = block.durationWeeks - idx;
  return remaining <= 2 ? "deload" : null;
}

export function blockDisplayWeek(block: ActiveTrainingBlock, date = todayKey()): number {
  const calendar = blockWeekIndex(block, date);
  const progress = Math.max(0, Math.min(block.durationWeeks - 1, block.currentWeekIndex));
  return Math.min(block.durationWeeks, Math.max(calendar, progress) + 1);
}

function exerciseName(id: string): string {
  return EXERCISES.find((e) => e.id === id)?.name ?? id;
}

export function prescriptionToPlannedDay(
  day: BlockDayPrescription,
  weekday: number,
): PlannedDay {
  const exercises: PlannedExercise[] = day.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    name: ex.name || exerciseName(ex.exerciseId),
    sets: ex.sets,
    reps: ex.reps,
    restSec: ex.restSec,
    suggestedLoad: ex.suggestedLoad ?? 0,
    unit: ex.unit,
  }));
  return {
    id: day.id,
    weekday,
    title: day.title,
    focus: day.focus ?? "",
    estimatedMin: day.estimatedMin ?? 45,
    exercises,
  };
}

export function resolveBlockDay(
  block: ActiveTrainingBlock,
  date: string,
  trainingWeekdays: number[],
): PlannedDay | null {
  const weekIdx = blockWeekIndex(block, date);
  const week = block.weeks[weekIdx] ?? block.weeks[block.currentWeekIndex];
  if (!week?.days?.length) return null;

  const weekday = parseYmd(date).getDay();
  const slots = trainingWeekdays.slice(0, block.sessionsPerWeek);
  const ordinal = slots.indexOf(weekday);
  if (ordinal < 0) return null;

  const sorted = [...week.days].sort((a, b) => a.day - b.day);
  const prescription =
    sorted.find((d) => d.day === ordinal + 1) ?? sorted[ordinal] ?? null;
  if (!prescription) return null;
  return prescriptionToPlannedDay(prescription, weekday);
}

export function buildWeeklyPlanFromBlock(
  block: ActiveTrainingBlock,
  profile: Pick<Profile, "daysPerWeek" | "trainingWeekdays">,
  date = todayKey(),
): PlannedDay[] {
  const weekIdx = blockWeekIndex(block, date);
  const week = block.weeks[weekIdx] ?? block.weeks[block.currentWeekIndex];
  if (!week?.days?.length) return [];
  const weekdays = resolveTrainingWeekdays(profile).slice(0, block.sessionsPerWeek);
  return [...week.days]
    .sort((a, b) => a.day - b.day)
    .map((day, i) =>
      prescriptionToPlannedDay(day, weekdays[i] ?? weekdays[weekdays.length - 1] ?? 1),
    );
}

export function activeBlockFromProgram(
  program: ContentProgram,
  sessions: ProgramSession[],
  startDate = todayKey(),
): ActiveTrainingBlock | null {
  const durationWeeks = clampBlockDurationWeeks(program.durationWeeks);
  const programSessions = sessions
    .filter((s) => s.programId === program.id)
    .sort((a, b) => a.week - b.week || a.day - b.day);

  const weeks: BlockWeek[] = [];
  for (let w = 1; w <= durationWeeks; w += 1) {
    const days: BlockDayPrescription[] = [];
    for (const s of programSessions.filter((x) => x.week === w)) {
      const parsed = parseProgramTraining(s.training);
      if (!parsed?.exercises.length) continue;
      days.push({
        id: s.id,
        day: s.day,
        title: parsed.title ?? `Dia ${s.day}`,
        ...(parsed.focus ? { focus: parsed.focus } : {}),
        ...(parsed.estimatedMin != null ? { estimatedMin: parsed.estimatedMin } : {}),
        exercises: parsed.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          name: exerciseName(ex.exerciseId),
          sets: ex.sets,
          reps: ex.reps,
          restSec: ex.restSec ?? 90,
          ...(ex.loadHint != null ? { suggestedLoad: ex.loadHint } : {}),
          unit: ex.unit ?? "kg",
        })),
      });
    }
    if (days.length) weeks.push({ week: w, days });
  }
  if (!weeks.length) return null;

  return {
    id: `block-${program.id}-${startDate}`,
    name: program.title,
    source: "content_program",
    programId: program.id,
    startDate: startDate.slice(0, 10),
    durationWeeks,
    sessionsPerWeek: Math.max(1, program.sessionsPerWeek || weeks[0]!.days.length),
    currentWeekIndex: 0,
    weeks,
    completedDayIds: [],
  };
}

/**
 * Mark a block day done. Advances currentWeekIndex when the week is complete.
 * Always returns the updated block (including the last completed dayId for archive).
 */
export function completeBlockDay(
  block: ActiveTrainingBlock,
  dayId: string,
): { block: ActiveTrainingBlock; finished: boolean; weekAdvanced: boolean } {
  if (!dayId) return { block, finished: false, weekAdvanced: false };
  const allIds = new Set(block.weeks.flatMap((w) => w.days.map((d) => d.id)));
  if (!allIds.has(dayId)) return { block, finished: false, weekAdvanced: false };
  if (block.completedDayIds.includes(dayId)) {
    return { block, finished: false, weekAdvanced: false };
  }

  const completedDayIds = [...block.completedDayIds, dayId];
  let currentWeekIndex = block.currentWeekIndex;
  let weekAdvanced = false;
  let finished = false;
  const week = block.weeks[currentWeekIndex];
  if (week) {
    const weekIds = week.days.map((d) => d.id);
    const weekDone = weekIds.every((id) => completedDayIds.includes(id));
    if (weekDone) {
      if (currentWeekIndex + 1 >= block.weeks.length) {
        finished = true;
      } else {
        currentWeekIndex += 1;
        weekAdvanced = true;
      }
    }
  }
  return {
    block: { ...block, completedDayIds, currentWeekIndex },
    finished,
    weekAdvanced,
  };
}

/** Scale sets/load for deload/leve Living Plan on a prescribed block day. */
export function scalePlannedDayVolume(
  day: PlannedDay,
  factor: number,
  roundLoadFn: (n: number) => number = (n) => Math.round(n * 2) / 2,
): PlannedDay {
  if (!Number.isFinite(factor) || factor >= 0.99) return day;
  const f = Math.max(0.5, Math.min(1, factor));
  return {
    ...day,
    estimatedMin: Math.max(15, Math.round(day.estimatedMin * f)),
    exercises: day.exercises.map((ex) => ({
      ...ex,
      sets: Math.max(1, Math.round(ex.sets * f)),
      suggestedLoad:
        ex.unit === "kg" && ex.suggestedLoad > 0
          ? roundLoadFn(ex.suggestedLoad * Math.max(0.7, f))
          : ex.suggestedLoad,
    })),
  };
}

export function archiveTrainingBlock(
  block: ActiveTrainingBlock,
  reason: ArchivedTrainingBlock["reason"],
  now = new Date(),
): ArchivedTrainingBlock {
  return { ...block, endedAt: now.toISOString(), reason };
}

export function pushBlockHistory(
  history: ArchivedTrainingBlock[] | undefined,
  archived: ArchivedTrainingBlock,
): ArchivedTrainingBlock[] {
  return [archived, ...(history ?? [])].slice(0, TRAINING_BLOCK_HISTORY_CAP);
}

export function mergeActiveTrainingBlock(
  local: ActiveTrainingBlock | null | undefined,
  remote: ActiveTrainingBlock | null | undefined,
): ActiveTrainingBlock | null {
  if (!local) return remote ?? null;
  if (!remote) return local;
  const localDone = local.completedDayIds?.length ?? 0;
  const remoteDone = remote.completedDayIds?.length ?? 0;
  if (local.currentWeekIndex !== remote.currentWeekIndex) {
    return local.currentWeekIndex >= remote.currentWeekIndex ? local : remote;
  }
  return localDone >= remoteDone ? local : remote;
}

export function mergeTrainingBlockHistory(
  local?: ArchivedTrainingBlock[],
  remote?: ArchivedTrainingBlock[],
): ArchivedTrainingBlock[] {
  const byId = new Map<string, ArchivedTrainingBlock>();
  for (const b of [...(remote ?? []), ...(local ?? [])]) {
    const prev = byId.get(b.id);
    if (!prev || (b.endedAt ?? "") >= (prev.endedAt ?? "")) byId.set(b.id, b);
  }
  return [...byId.values()]
    .sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))
    .slice(0, TRAINING_BLOCK_HISTORY_CAP);
}

export function blockContainsDayId(
  block: ActiveTrainingBlock | null | undefined,
  dayId: string | null | undefined,
): boolean {
  if (!block || !dayId) return false;
  return block.weeks.some((w) => w.days.some((d) => d.id === dayId));
}
