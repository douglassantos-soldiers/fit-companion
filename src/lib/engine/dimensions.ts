import type { AppState, Profile, SessionLog } from "@/lib/types";
import { todayKey } from "@/lib/types";

export interface Dimension {
  key: string;
  label: string;
  score: number;
}

const clamp = (n: number) => Math.max(5, Math.min(100, Math.round(n)));

export function last7Dates(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

export function sessionsInLastDays(sessions: SessionLog[], days: number) {
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return sessions.filter((s) => new Date(s.date) >= limit);
}

export function streak(sessions: SessionLog[]) {
  const dates = new Set(sessions.map((s) => s.date.slice(0, 10)));
  let count = 0;
  const cursor = new Date();
  // Permite que o streak conte a partir de ontem se hoje ainda não treinou.
  if (!dates.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(todayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function performanceDimensions(state: AppState, profile: Profile): Dimension[] {
  const recent = sessionsInLastDays(state.sessions, 28);
  const volume = recent.reduce((s, x) => s + x.volumeKg, 0);
  const planned = profile.daysPerWeek * 4;
  const consistency = planned ? (recent.length / planned) * 100 : 0;

  const cardioSessions = recent.filter((s) =>
    s.exercises.some((e) => e.exerciseId.includes("corrida") || e.exerciseId.includes("hiit") || e.exerciseId.includes("corda") || e.exerciseId.includes("burpee")),
  ).length;

  const supplementDays = Object.entries(state.supplementLogs).filter(([, v]) => v.length > 0).length;
  const waterDays = Object.values(state.days).filter((d) => d.waterMl >= 2000).length;

  const base = profile.level === "avancado" ? 55 : profile.level === "intermediario" ? 40 : 25;

  return [
    { key: "forca", label: "Força", score: clamp(base + volume / 800) },
    { key: "resistencia", label: "Resistência", score: clamp(base * 0.8 + cardioSessions * 9) },
    { key: "consistencia", label: "Consistência", score: clamp(20 + consistency * 0.8) },
    { key: "recuperacao", label: "Recuperação", score: clamp(35 + waterDays * 5 - Math.max(0, recent.length - planned) * 4) },
    { key: "nutricao", label: "Nutrição", score: clamp(25 + supplementDays * 4) },
  ];
}

export function performanceScore(dims: Dimension[]) {
  if (!dims.length) return 0;
  return Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);
}

export function weeklyVolumeSeries(sessions: SessionLog[], weeks = 8) {
  const buckets: { label: string; volume: number; treinos: number }[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = new Date();
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const inRange = sessions.filter((s) => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });
    buckets.push({
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      volume: Math.round(inRange.reduce((sum, s) => sum + s.volumeKg, 0)),
      treinos: inRange.length,
    });
  }
  return buckets;
}

export function personalRecords(sessions: SessionLog[]) {
  const records = new Map<string, { weightKg: number; reps: number; date: string }>();
  for (const session of sessions) {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        if (!set.done) continue;
        const current = records.get(ex.exerciseId);
        if (!current || set.weightKg > current.weightKg) {
          records.set(ex.exerciseId, { weightKg: set.weightKg, reps: set.reps, date: session.date });
        }
      }
    }
  }
  return [...records.entries()].map(([exerciseId, r]) => ({ exerciseId, ...r }));
}
