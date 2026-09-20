import { exerciseById } from "@/data/exercises";
import { countableSets, sessionRpeFromSets } from "@/lib/training/effort";
import type { SessionLog, SessionRpe } from "@/lib/types";

export interface ExerciseHit {
  sessionId: string;
  date: string;
  maxWeightKg: number;
  avgReps: number;
  volumeKg: number;
  setsDone: number;
  setsTotal: number;
  allDone: boolean;
  rpe?: SessionRpe;
}

export type ExerciseTrend = "up" | "flat" | "down" | "unknown";

export interface ExerciseHistorySummary {
  exerciseId: string;
  name: string;
  hits: ExerciseHit[];
  prWeightKg: number;
  prReps: number;
  trend: ExerciseTrend;
  plateau: boolean;
  plateauWindow: number;
}

const LOAD_EPS = 0.5;
const VOLUME_EPS = 0.02; // 2%

/** Hits for one exercise, newest first. */
export function hitsForExercise(exerciseId: string, sessions: SessionLog[]): ExerciseHit[] {
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const hits: ExerciseHit[] = [];
  for (const session of ordered) {
    const log = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!log || !log.sets.length) continue;
    const working = countableSets(log.sets);
    const pool = working.length ? working : log.sets;
    const doneSets = pool.filter((s) => s.done && !s.skipped);
    const maxWeightKg = Math.max(...pool.map((s) => s.weightKg), 0);
    const avgReps =
      doneSets.length > 0
        ? doneSets.reduce((sum, s) => sum + s.reps, 0) / doneSets.length
        : 0;
    const volumeKg = doneSets.reduce((sum, s) => sum + s.reps * (s.weightKg || 0), 0);
    const derivedRpe = session.rpe ?? sessionRpeFromSets(log.sets);
    hits.push({
      sessionId: session.id,
      date: session.date,
      maxWeightKg,
      avgReps: Math.round(avgReps * 10) / 10,
      volumeKg: Math.round(volumeKg),
      setsDone: doneSets.length,
      setsTotal: pool.length,
      allDone: pool.length > 0 && pool.every((s) => s.done || s.skipped),
      ...(derivedRpe ? { rpe: derivedRpe } : {}),
    });
  }
  return hits;
}

export function trendFromHits(hits: ExerciseHit[], window = 4): ExerciseTrend {
  const slice = hits.slice(0, window);
  if (slice.length < 2) return "unknown";
  // chronological oldest → newest within window
  const chron = [...slice].reverse();
  const first = chron[0]!;
  const last = chron[chron.length - 1]!;
  const loadDelta = last.maxWeightKg - first.maxWeightKg;
  const volDelta = last.volumeKg - first.volumeKg;
  if (loadDelta > LOAD_EPS || volDelta > first.volumeKg * VOLUME_EPS) return "up";
  if (loadDelta < -LOAD_EPS || volDelta < -first.volumeKg * VOLUME_EPS) return "down";
  return "flat";
}

/**
 * Plateau: 3–5 recent hits with no load/volume progress and RPE never "facil".
 */
export function detectPlateau(hits: ExerciseHit[], window = 4): boolean {
  const n = Math.min(Math.max(window, 3), 5);
  const slice = hits.slice(0, n);
  if (slice.length < 3) return false;

  const anyEasy = slice.some((h) => h.rpe === "facil");
  if (anyEasy) return false;

  // chronological oldest → newest
  const chron = [...slice].reverse();
  let maxLoad = chron[0]!.maxWeightKg;
  let maxVol = chron[0]!.volumeKg;
  let progressed = false;
  for (let i = 1; i < chron.length; i++) {
    const h = chron[i]!;
    if (h.maxWeightKg > maxLoad + LOAD_EPS) {
      progressed = true;
      break;
    }
    if (h.volumeKg > maxVol * (1 + VOLUME_EPS) + 1) {
      progressed = true;
      break;
    }
    maxLoad = Math.max(maxLoad, h.maxWeightKg);
    maxVol = Math.max(maxVol, h.volumeKg);
  }
  return !progressed;
}

export function summarizeExercise(
  exerciseId: string,
  sessions: SessionLog[],
  plateauWindow = 4,
): ExerciseHistorySummary {
  const hits = hitsForExercise(exerciseId, sessions);
  const ex = exerciseById(exerciseId);
  let prWeightKg = 0;
  let prReps = 0;
  for (const h of hits) {
    if (h.maxWeightKg > prWeightKg) {
      prWeightKg = h.maxWeightKg;
      prReps = Math.round(h.avgReps);
    }
  }
  const plateau = detectPlateau(hits, plateauWindow);
  return {
    exerciseId,
    name: ex?.name ?? exerciseId,
    hits,
    prWeightKg,
    prReps,
    trend: trendFromHits(hits),
    plateau,
    plateauWindow,
  };
}

/** Exercises with at least one logged set, sorted by hit count then recency. */
export function listExercisesWithHistory(sessions: SessionLog[], limit = 24): ExerciseHistorySummary[] {
  const ids = new Set<string>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (e.sets.some((set) => set.done || set.weightKg > 0 || set.reps > 0)) {
        ids.add(e.exerciseId);
      }
    }
  }
  const summaries = [...ids].map((id) => summarizeExercise(id, sessions));
  summaries.sort((a, b) => {
    if (b.hits.length !== a.hits.length) return b.hits.length - a.hits.length;
    const aDate = a.hits[0]?.date ?? "";
    const bDate = b.hits[0]?.date ?? "";
    return bDate.localeCompare(aDate);
  });
  return summaries.slice(0, limit);
}

export function formatLastPerformance(hit: ExerciseHit | undefined): string | null {
  if (!hit) return null;
  const load =
    hit.maxWeightKg > 0 ? `${hit.maxWeightKg} kg × ${Math.round(hit.avgReps)}` : `${Math.round(hit.avgReps)} reps`;
  const rpe = hit.rpe ? ` (RPE ${hit.rpe})` : "";
  return `${load}${rpe}`;
}

/** Plateau exercise ids among those present in the last N sessions' exercise lists. */
export function plateauExerciseIds(sessions: SessionLog[], amongIds?: string[]): string[] {
  const ids =
    amongIds ??
    listExercisesWithHistory(sessions, 50).map((s) => s.exerciseId);
  return ids.filter((id) => detectPlateau(hitsForExercise(id, sessions)));
}
