/**
 * Set prescription vs execution adapters.
 * Legacy SetLog { reps, weightKg, done } remains the sync contract.
 */
import type { SetLog, SetType } from "@/lib/types";

export interface SetPrescription {
  setNumber: number;
  type: SetType;
  targetReps: string;
  targetWeight: number;
  restSec: number;
}

export interface SetExecution {
  id: string;
  exerciseId: string;
  setNumber: number;
  type: SetType;
  targetReps?: string;
  targetWeight?: number;
  actualReps: number;
  actualWeight: number;
  rpe?: number;
  rir?: number;
  restSec?: number;
  completed: boolean;
  timestamp?: string;
  notes?: string;
}

let _seq = 0;
function nextSetId() {
  _seq += 1;
  return `set-${Date.now()}-${_seq}`;
}

/** Normalize legacy or rich SetLog into SetExecution. */
export function toSetExecution(
  set: SetLog,
  exerciseId: string,
  setNumber: number,
): SetExecution {
  const completed = set.completed ?? set.done;
  const actualReps = set.actualReps ?? set.reps;
  const actualWeight = set.actualWeight ?? set.weightKg;
  return {
    id: set.id ?? nextSetId(),
    exerciseId,
    setNumber: set.setNumber ?? setNumber,
    type: set.type ?? "working",
    ...(set.targetReps != null ? { targetReps: set.targetReps } : {}),
    ...(set.targetWeight != null ? { targetWeight: set.targetWeight } : {}),
    actualReps,
    actualWeight,
    ...(set.rpe != null ? { rpe: set.rpe } : {}),
    ...(set.rir != null ? { rir: set.rir } : {}),
    ...(set.restSec != null ? { restSec: set.restSec } : {}),
    completed,
    ...(set.timestamp ? { timestamp: set.timestamp } : {}),
    ...(set.notes ? { notes: set.notes } : {}),
  };
}

/** Flatten execution back to SetLog for JSONB persistence. */
export function toLegacySetLog(exec: SetExecution): SetLog {
  return {
    reps: exec.actualReps,
    weightKg: exec.actualWeight,
    done: exec.completed,
    id: exec.id,
    setNumber: exec.setNumber,
    type: exec.type,
    ...(exec.targetReps != null ? { targetReps: exec.targetReps } : {}),
    ...(exec.targetWeight != null ? { targetWeight: exec.targetWeight } : {}),
    actualReps: exec.actualReps,
    actualWeight: exec.actualWeight,
    ...(exec.rpe != null ? { rpe: exec.rpe } : {}),
    ...(exec.rir != null ? { rir: exec.rir } : {}),
    ...(exec.restSec != null ? { restSec: exec.restSec } : {}),
    completed: exec.completed,
    ...(exec.timestamp ? { timestamp: exec.timestamp } : {}),
    ...(exec.notes ? { notes: exec.notes } : {}),
  };
}

export function enrichSetLog(
  set: SetLog,
  opts: {
    setNumber: number;
    type?: SetType;
    targetReps?: string;
    targetWeight?: number;
    restSec?: number;
  },
): SetLog {
  return {
    ...set,
    setNumber: set.setNumber ?? opts.setNumber,
    type: set.type ?? opts.type ?? "working",
    ...(opts.targetReps != null && set.targetReps == null ? { targetReps: opts.targetReps } : {}),
    ...(opts.targetWeight != null && set.targetWeight == null
      ? { targetWeight: opts.targetWeight }
      : {}),
    ...(opts.restSec != null && set.restSec == null ? { restSec: opts.restSec } : {}),
    actualReps: set.actualReps ?? set.reps,
    actualWeight: set.actualWeight ?? set.weightKg,
    completed: set.completed ?? set.done,
  };
}

export function buildPrescriptions(
  sets: number,
  reps: string,
  load: number,
  restSec: number,
): SetPrescription[] {
  return Array.from({ length: sets }, (_, i) => ({
    setNumber: i + 1,
    type: "working" as const,
    targetReps: reps,
    targetWeight: load,
    restSec,
  }));
}
