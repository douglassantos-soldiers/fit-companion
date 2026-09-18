import { EXERCISES, exerciseById, type MuscleGroup } from "@/data/exercises";
import type { SessionLog } from "@/lib/types";

export interface MuscleRecovery {
  group: MuscleGroup;
  label: string;
  freshness: number; // 0–100, 100 = fresco
  lastTrainedHours: number | null;
}

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

const ALL_GROUPS = Object.keys(GROUP_LABEL) as MuscleGroup[];

function hoursSince(iso: string, now = new Date()) {
  return (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

/** Frescor 0–100 com decay linear até o tempo de recuperação do grupo. */
export function muscleRecoveryMap(sessions: SessionLog[], now = new Date()): MuscleRecovery[] {
  const lastHit = new Map<MuscleGroup, { date: string; volume: number }>();

  for (const session of sessions) {
    for (const log of session.exercises) {
      const ex = exerciseById(log.exerciseId);
      if (!ex) continue;
      const vol = log.sets.reduce((s, set) => (set.done ? s + set.reps * (set.weightKg || 10) : s), 0);
      const prev = lastHit.get(ex.group);
      if (!prev || session.date > prev.date) {
        lastHit.set(ex.group, { date: session.date, volume: vol });
      }
    }
  }

  return ALL_GROUPS.map((group) => {
    const hit = lastHit.get(group);
    const window = RECOVERY_HOURS[group];
    if (!hit) {
      return { group, label: GROUP_LABEL[group], freshness: 100, lastTrainedHours: null };
    }
    const hrs = hoursSince(hit.date, now);
    const freshness = Math.max(0, Math.min(100, Math.round((hrs / window) * 100)));
    return { group, label: GROUP_LABEL[group], freshness, lastTrainedHours: Math.round(hrs) };
  });
}

export function freshnessForGroups(groups: MuscleGroup[], sessions: SessionLog[]) {
  const map = muscleRecoveryMap(sessions);
  const scores = groups.map((g) => map.find((m) => m.group === g)?.freshness ?? 100);
  if (!scores.length) return 100;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function sortGroupsByFreshness(groups: MuscleGroup[], sessions: SessionLog[]) {
  const map = new Map(muscleRecoveryMap(sessions).map((m) => [m.group, m.freshness]));
  return [...groups].sort((a, b) => (map.get(b) ?? 100) - (map.get(a) ?? 100));
}

export function recoveryLabel(freshness: number) {
  if (freshness >= 70) return "Pronto";
  if (freshness >= 35) return "Ok";
  return "Fatigado";
}

export { GROUP_LABEL, ALL_GROUPS, EXERCISES };
