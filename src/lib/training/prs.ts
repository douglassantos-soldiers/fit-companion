/**
 * Personal Records engine — typed PRs derived from session logs.
 */
import { exerciseById } from "@/data/exercises";
import { hitsForExercise, listExercisesWithHistory } from "@/lib/engine/exercise-history";
import { estimated1RM, oneRmFromHit } from "@/lib/training/one-rm";
import type { SessionLog } from "@/lib/types";

export type PrType =
  | "WEIGHT_PR"
  | "REP_PR"
  | "VOLUME_PR"
  | "ESTIMATED_1RM_PR"
  | "SESSION_VOLUME_PR";

export interface PersonalRecord {
  id: string;
  exerciseId: string | null;
  prType: PrType;
  value: number;
  previousValue: number | null;
  sessionId: string;
  achievedAt: string;
  label: string;
}

function prId(exerciseId: string | null, prType: PrType, value: number, date: string) {
  return `${exerciseId ?? "session"}:${prType}:${value}:${date}`;
}

export function detectExercisePrs(exerciseId: string, sessions: SessionLog[]): PersonalRecord[] {
  const hits = hitsForExercise(exerciseId, sessions);
  if (!hits.length) return [];
  const name = exerciseById(exerciseId)?.name ?? exerciseId;
  // chronological oldest → newest
  const chron = [...hits].reverse();
  const out: PersonalRecord[] = [];
  let bestW = 0;
  let bestRepsAtLoad = 0;
  let bestVol = 0;
  let best1rm = 0;

  for (const h of chron) {
    if (h.maxWeightKg > bestW + 0.01) {
      out.push({
        id: prId(exerciseId, "WEIGHT_PR", h.maxWeightKg, h.date),
        exerciseId,
        prType: "WEIGHT_PR",
        value: h.maxWeightKg,
        previousValue: bestW > 0 ? bestW : null,
        sessionId: h.sessionId,
        achievedAt: h.date,
        label: `PR de ${name}: ${h.maxWeightKg} kg.`,
      });
      bestW = h.maxWeightKg;
      bestRepsAtLoad = h.avgReps;
    } else if (
      Math.abs(h.maxWeightKg - bestW) < 0.01 &&
      h.avgReps > bestRepsAtLoad + 0.4
    ) {
      out.push({
        id: prId(exerciseId, "REP_PR", h.avgReps, h.date),
        exerciseId,
        prType: "REP_PR",
        value: Math.round(h.avgReps * 10) / 10,
        previousValue: bestRepsAtLoad,
        sessionId: h.sessionId,
        achievedAt: h.date,
        label: `PR de reps em ${name}: ${Math.round(h.avgReps)} @ ${h.maxWeightKg} kg.`,
      });
      bestRepsAtLoad = h.avgReps;
    }

    if (h.volumeKg > bestVol * 1.02 + 1) {
      out.push({
        id: prId(exerciseId, "VOLUME_PR", h.volumeKg, h.date),
        exerciseId,
        prType: "VOLUME_PR",
        value: h.volumeKg,
        previousValue: bestVol > 0 ? bestVol : null,
        sessionId: h.sessionId,
        achievedAt: h.date,
        label: `PR de volume em ${name}: ${h.volumeKg} kg.`,
      });
      bestVol = h.volumeKg;
    }

    const orm = oneRmFromHit(h);
    if (orm && orm.value > best1rm + 0.5) {
      out.push({
        id: prId(exerciseId, "ESTIMATED_1RM_PR", orm.value, h.date),
        exerciseId,
        prType: "ESTIMATED_1RM_PR",
        value: orm.value,
        previousValue: best1rm > 0 ? best1rm : null,
        sessionId: h.sessionId,
        achievedAt: h.date,
        label: `PR de 1RM estimado em ${name}: ${orm.value} kg.`,
      });
      best1rm = orm.value;
    }
  }

  return out;
}

export function detectSessionVolumePrs(sessions: SessionLog[]): PersonalRecord[] {
  const chron = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  const out: PersonalRecord[] = [];
  for (const s of chron) {
    if (s.volumeKg > best + 1) {
      out.push({
        id: prId(null, "SESSION_VOLUME_PR", s.volumeKg, s.date),
        exerciseId: null,
        prType: "SESSION_VOLUME_PR",
        value: Math.round(s.volumeKg),
        previousValue: best > 0 ? Math.round(best) : null,
        sessionId: s.id,
        achievedAt: s.date,
        label: `PR de volume da sessão: ${Math.round(s.volumeKg)} kg.`,
      });
      best = s.volumeKg;
    }
  }
  return out;
}

/** All current bests (latest value per type/exercise) — for display / persist. */
export function currentPersonalRecords(sessions: SessionLog[]): PersonalRecord[] {
  const byKey = new Map<string, PersonalRecord>();
  for (const sum of listExercisesWithHistory(sessions, 80)) {
    for (const pr of detectExercisePrs(sum.exerciseId, sessions)) {
      const key = `${pr.exerciseId}:${pr.prType}`;
      const prev = byKey.get(key);
      if (!prev || pr.achievedAt >= prev.achievedAt) byKey.set(key, pr);
    }
  }
  for (const pr of detectSessionVolumePrs(sessions)) {
    const key = `session:${pr.prType}`;
    const prev = byKey.get(key);
    if (!prev || pr.achievedAt >= prev.achievedAt) byKey.set(key, pr);
  }
  return [...byKey.values()].sort((a, b) => b.achievedAt.localeCompare(a.achievedAt));
}

/** Compatibility with dimensions.personalRecords shape. */
export function weightPersonalRecords(sessions: SessionLog[]) {
  const map = new Map<string, { weightKg: number; reps: number; date: string }>();
  for (const sum of listExercisesWithHistory(sessions, 80)) {
    const hits = hitsForExercise(sum.exerciseId, sessions);
    for (const h of hits) {
      const cur = map.get(sum.exerciseId);
      if (!cur || h.maxWeightKg > cur.weightKg) {
        map.set(sum.exerciseId, {
          weightKg: h.maxWeightKg,
          reps: Math.round(h.avgReps),
          date: h.date,
        });
      }
    }
  }
  return [...map.entries()].map(([exerciseId, r]) => ({ exerciseId, ...r }));
}

export { estimated1RM };
