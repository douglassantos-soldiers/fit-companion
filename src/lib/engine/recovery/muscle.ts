/**
 * Per-muscle recovery — consumes muscle-load (training domain) + recency + optional systemic ctx.
 */
import { EXERCISES, exerciseById, type MuscleGroup } from "@/data/exercises";
import { muscleLoadByGroup, type MuscleLoadStats } from "@/lib/training/muscle-load";
import type { DayEnergy, SessionLog } from "@/lib/types";
import type { MuscleRecoveryRow, MuscleRecoveryStatus } from "@/lib/engine/recovery/types";

export interface MuscleRecovery {
  group: MuscleGroup;
  label: string;
  freshness: number;
  lastTrainedHours: number | null;
  lastVolume: number | null;
}

export type MuscleRecoverySnapshot = MuscleRecoveryRow;

const GROUP_LABEL: Record<MuscleGroup, string> = {
  peito: "Peito",
  costas: "Costas",
  pernas: "Pernas",
  ombros: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  core: "Core",
  cardio: "Cardio",
};

const RECOVERY_HOURS: Record<MuscleGroup, number> = {
  peito: 48,
  costas: 48,
  pernas: 72,
  ombros: 48,
  biceps: 36,
  triceps: 36,
  core: 24,
  cardio: 24,
};

const VOLUME_REF = 2000;
const ALL_GROUPS = Object.keys(GROUP_LABEL) as MuscleGroup[];

function hoursSince(iso: string, now = new Date()) {
  return (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function volumeWindowFactor(volume: number) {
  if (volume <= 0) return 1;
  const ratio = Math.min(1, volume / VOLUME_REF);
  return 1 + ratio * 0.5;
}

export type RecoveryContext = {
  sleepHours?: number | null;
  energy?: DayEnergy | null;
  sessionRpeHardStreak?: number;
};

function statusFromFreshness(
  freshness: number,
  hasHit: boolean,
  load7: number,
): MuscleRecoveryStatus {
  if (!hasHit && load7 < 2) return "unknown";
  if (freshness >= 70) return "fresh";
  if (freshness >= 35) return "ok";
  return "fatigued";
}

/** Full recovery snapshot per muscle. */
export function buildMuscleRecoverySnapshots(
  sessions: SessionLog[],
  ctx: RecoveryContext = {},
  now = new Date(),
): MuscleRecoverySnapshot[] {
  const loadMap = muscleLoadByGroup(sessions, now);
  const lastHit = new Map<MuscleGroup, { date: string; volume: number }>();

  for (const session of sessions) {
    for (const log of session.exercises) {
      const ex = exerciseById(log.exerciseId);
      if (!ex) continue;
      const vol = log.sets.reduce(
        (s, set) => (set.done ? s + set.reps * (set.weightKg || 10) : s),
        0,
      );
      const prev = lastHit.get(ex.group);
      if (!prev || session.date > prev.date) {
        lastHit.set(ex.group, { date: session.date, volume: vol });
      }
    }
  }

  return ALL_GROUPS.map((muscle) => {
    const load: MuscleLoadStats | undefined = loadMap.get(muscle);
    const hit = lastHit.get(muscle);
    const reasonCodes: string[] = [];
    let freshness = 100;
    let lastTrainedHours: number | null = null;
    let confidence = 0.45;

    if (hit) {
      const window = RECOVERY_HOURS[muscle] * volumeWindowFactor(hit.volume);
      const hrs = hoursSince(hit.date, now);
      lastTrainedHours = Math.round(hrs);
      freshness = Math.max(0, Math.min(100, Math.round((hrs / window) * 100)));
      confidence = 0.6;
      if (hrs < RECOVERY_HOURS[muscle] * 0.5) reasonCodes.push("recent_training");
    }

    const load7 = load?.rolling_7d ?? 0;
    const load28 = load?.rolling_28d ?? 0;
    const direct7 = load?.direct_sets ?? load7;
    const direct28 = load28;
    const effective = load?.effective_sets ?? load7;
    const fatigueContribution = load?.fatigue_contribution ?? Math.min(1, load7 / 20);

    if (load7 >= 16) {
      freshness = Math.max(0, freshness - 15);
      reasonCodes.push("excessive_muscle_load");
      confidence = Math.max(confidence, 0.7);
    } else if (load7 <= 4 && hit) {
      reasonCodes.push("low_muscle_fatigue");
    } else if (load7 < 2) {
      reasonCodes.push("undertrained_muscle");
    }

    if (ctx.sleepHours != null && ctx.sleepHours < 6) {
      freshness = Math.max(0, freshness - 10);
      reasonCodes.push("sleep_low");
      confidence = Math.max(confidence, 0.65);
    }
    if (ctx.energy === "baixa") {
      freshness = Math.max(0, freshness - 8);
      reasonCodes.push("energy_low");
    }
    if ((ctx.sessionRpeHardStreak ?? 0) >= 2) {
      freshness = Math.max(0, freshness - 8);
      reasonCodes.push("rpe_high");
    }

    const estimatedRecovery = freshness;
    return {
      muscle,
      label: GROUP_LABEL[muscle],
      freshness,
      load7d: load7,
      load28d: load28,
      estimatedRecovery,
      recoveryEstimate: estimatedRecovery,
      directLoad7d: direct7,
      directLoad28d: direct28,
      effectiveLoad: effective,
      fatigueContribution,
      status: statusFromFreshness(freshness, Boolean(hit), load7),
      confidence,
      reasonCodes: [...new Set(reasonCodes)],
      lastTrainedHours,
    };
  });
}

/** Compat API used by plan / heatmap. */
export function muscleRecoveryMap(
  sessions: SessionLog[],
  now = new Date(),
  ctx: RecoveryContext = {},
): MuscleRecovery[] {
  const snaps = buildMuscleRecoverySnapshots(sessions, ctx, now);
  const volByGroup = new Map<MuscleGroup, number>();
  const dateByGroup = new Map<MuscleGroup, string>();
  for (const session of sessions) {
    for (const log of session.exercises) {
      const ex = exerciseById(log.exerciseId);
      if (!ex) continue;
      const vol = log.sets.reduce(
        (s, set) => (set.done ? s + set.reps * (set.weightKg || 10) : s),
        0,
      );
      const prev = dateByGroup.get(ex.group);
      if (!prev || session.date > prev) {
        dateByGroup.set(ex.group, session.date);
        volByGroup.set(ex.group, Math.round(vol));
      }
    }
  }

  return snaps.map((s) => ({
    group: s.muscle,
    label: s.label,
    freshness: s.freshness,
    lastTrainedHours: s.lastTrainedHours,
    lastVolume: volByGroup.get(s.muscle) ?? null,
  }));
}

export function freshnessForGroups(
  groups: MuscleGroup[],
  sessions: SessionLog[],
  ctx: RecoveryContext = {},
) {
  const map = muscleRecoveryMap(sessions, new Date(), ctx);
  const scores = groups.map((g) => map.find((m) => m.group === g)?.freshness ?? 100);
  if (!scores.length) return 100;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function sortGroupsByFreshness(
  groups: MuscleGroup[],
  sessions: SessionLog[],
  ctx: RecoveryContext = {},
) {
  const map = new Map(
    muscleRecoveryMap(sessions, new Date(), ctx).map((m) => [m.group, m.freshness]),
  );
  return [...groups].sort((a, b) => (map.get(b) ?? 100) - (map.get(a) ?? 100));
}

export function recoveryLabel(freshness: number) {
  if (freshness >= 70) return "Pronto";
  if (freshness >= 35) return "Ok";
  return "Fatigado";
}

export function freshnessToHeat(freshness: number): number {
  return Math.max(0.12, Math.min(1, freshness / 100));
}

export { GROUP_LABEL, ALL_GROUPS, EXERCISES, RECOVERY_HOURS };
