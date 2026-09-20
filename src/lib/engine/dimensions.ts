import { isQuestComplete, questById } from "@/data/daily-quests";
import { computeLearningInsights } from "@/lib/engine/learning";
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { monthlyDoseAdherence } from "@/lib/engine/supplements";
import type { AppState, Profile, SessionLog, TrafficLight } from "@/lib/types";
import { todayKey } from "@/lib/types";
import { weightPersonalRecords } from "@/lib/training/prs";

export interface Dimension {
  key: string;
  label: string;
  score: number;
}

const clamp = (n: number) => Math.max(5, Math.min(100, Math.round(n)));
const clampAdherence = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

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

export interface StreakOpts {
  freezeUsedDates?: string[];
}

export function streak(sessions: SessionLog[], opts: StreakOpts = {}) {
  const dates = new Set(sessions.map((s) => s.date.slice(0, 10)));
  for (const f of opts.freezeUsedDates ?? []) dates.add(f.slice(0, 10));
  let count = 0;
  const cursor = new Date();
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
    s.exercises.some(
      (e) =>
        e.exerciseId.includes("corrida") ||
        e.exerciseId.includes("hiit") ||
        e.exerciseId.includes("corda") ||
        e.exerciseId.includes("burpee"),
    ),
  ).length;

  const waterDays = Object.values(state.days).filter((d) => d.waterMl >= 2000).length;
  const insights = computeLearningInsights(state);
  const goals = nutritionGoals(profile, insights);
  const todayMeals = dayNutritionTotals(state.meals ?? []);
  const proteinHit = Math.min(100, (todayMeals.proteinG / Math.max(1, goals.proteinG)) * 100);
  const mealHit = Math.min(100, (todayMeals.count / Math.max(1, goals.mealsTarget)) * 100);

  const routine = state.supplementRoutine;
  const supplementScore = routine.length
    ? monthlyDoseAdherence(state.supplementLogs, routine).pct
    : Math.min(100, Object.entries(state.supplementLogs).filter(([, v]) => v.length > 0).length * 4);

  const sleepEntries = Object.values(state.dayCheckIns ?? {})
    .filter((c) => c.sleepHours > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7);
  const sleepAvg = sleepEntries.length
    ? sleepEntries.reduce((s, c) => s + c.sleepHours, 0) / sleepEntries.length
    : (profile.typicalSleepHours ?? 7);
  const sleepScore = clamp((sleepAvg / 8) * 100 - (sleepAvg < 6 ? 15 : 0));

  const checkIn = state.dayCheckIns?.[todayKey()];
  const energyPenalty = checkIn?.energy === "baixa" ? 18 : checkIn?.energy === "ok" ? 0 : -5;
  const recoveryScore = clamp(
    30 + waterDays * 4 + sleepScore * 0.35 - Math.max(0, recent.length - planned) * 4 - energyPenalty,
  );

  const questIds = state.dailyQuestIds ?? [];
  const habitsDone = questIds.filter((id) => {
    const q = questById(id);
    return q ? isQuestComplete(state, q) : false;
  }).length;
  const habits = questIds.length ? clamp(25 + (habitsDone / questIds.length) * 75) : 45;

  const base = profile.level === "avancado" ? 55 : profile.level === "intermediario" ? 40 : 25;

  return [
    { key: "forca", label: "Treinamento", score: clamp(base + volume / 800) },
    { key: "resistencia", label: "Condicionamento", score: clamp(base * 0.8 + cardioSessions * 9) },
    { key: "consistencia", label: "Consistência", score: clamp(20 + consistency * 0.8) },
    { key: "recuperacao", label: "Recuperação", score: recoveryScore },
    { key: "sono", label: "Sono", score: sleepScore },
    { key: "nutricao", label: "Nutrição", score: clamp(proteinHit * 0.55 + mealHit * 0.45) },
    // Supplementation is Adherence — not Performance. No artificial floor.
    { key: "suplementacao", label: "Suplementação", score: clampAdherence(supplementScore) },
    { key: "habitos", label: "Hábitos", score: habits },
  ];
}

/**
 * Performance score excludes supplementation (commerce/adherence must not inflate performance).
 * Axes: treinamento, condicionamento, consistência, recuperação, sono.
 */
export function performanceScore(dims: Dimension[]) {
  const perfKeys = new Set(["forca", "resistencia", "consistencia", "recuperacao", "sono"]);
  const perf = dims.filter((d) => perfKeys.has(d.key));
  const use = perf.length ? perf : dims.filter((d) => d.key !== "suplementacao");
  if (!use.length) return 0;
  return Math.round(use.reduce((s, d) => s + d.score, 0) / use.length);
}

/** Nutrition + habits + supplementation as a separate adherence composite. */
export function adherenceScore(dims: Dimension[]) {
  const keys = new Set(["nutricao", "suplementacao", "habitos"]);
  const use = dims.filter((d) => keys.has(d.key));
  if (!use.length) return 0;
  return Math.round(use.reduce((s, d) => s + d.score, 0) / use.length);
}

/** Weakest axis; prefers axes declining vs last snapshot. */
export function primaryBlockerDimension(state: AppState, profile: Profile): Dimension | null {
  const dims = performanceDimensions(state, profile);
  if (!dims.length) return null;

  const prev = [...(state.dimensionSnapshots ?? [])]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .find((s) => s.date !== todayKey());

  let best: Dimension | null = null;
  let bestRank = Infinity;
  for (const d of dims) {
    const trend = prev?.scores[d.key] != null ? d.score - (prev.scores[d.key] as number) : 0;
    const rank = d.score - Math.min(0, trend) * 0.5;
    if (rank < bestRank) {
      bestRank = rank;
      best = d;
    }
  }

  if (profile.primaryBlocker && best) {
    const map: Record<string, string[]> = {
      sono: ["sono", "recuperacao"],
      alimentacao: ["nutricao"],
      consistencia: ["consistencia", "habitos"],
      tempo: ["consistencia", "habitos"],
      equipamento: ["forca", "resistencia"],
    };
    const keys = map[profile.primaryBlocker] ?? [];
    const biased = dims.find((d) => keys.includes(d.key) && d.score <= best!.score + 8);
    if (biased) return biased;
  }
  return best;
}

export function trafficForScore(score: number): TrafficLight {
  if (score >= 70) return "green";
  if (score >= 50) return "yellow";
  return "red";
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
  return weightPersonalRecords(sessions);
}

export interface WeekOverWeek {
  thisWeek: { volume: number; treinos: number; label: string };
  prevWeek: { volume: number; treinos: number; label: string };
  volumeDeltaPct: number | null;
  treinosDelta: number;
}

/** Compare the last two buckets from weeklyVolumeSeries. */
export function weekOverWeek(sessions: SessionLog[]): WeekOverWeek {
  const series = weeklyVolumeSeries(sessions, 2);
  const prev = series[0] ?? { label: "—", volume: 0, treinos: 0 };
  const curr = series[1] ?? series[0] ?? { label: "—", volume: 0, treinos: 0 };
  const volumeDeltaPct =
    prev.volume > 0 ? Math.round(((curr.volume - prev.volume) / prev.volume) * 100) : curr.volume > 0 ? 100 : null;
  return {
    thisWeek: { volume: curr.volume, treinos: curr.treinos, label: curr.label },
    prevWeek: { volume: prev.volume, treinos: prev.treinos, label: prev.label },
    volumeDeltaPct,
    treinosDelta: curr.treinos - prev.treinos,
  };
}

export interface HeatmapCell {
  date: string;
  count: number;
  volumeKg: number;
  level: 0 | 1 | 2 | 3 | 4;
}

/** GitHub-style frequency grid for the last `weeks` weeks (Mon–Sun columns by week). */
export function frequencyHeatmap(sessions: SessionLog[], weeks = 12): HeatmapCell[] {
  const byDate = new Map<string, { count: number; volumeKg: number }>();
  for (const s of sessions) {
    const key = s.date.slice(0, 10);
    const cur = byDate.get(key) ?? { count: 0, volumeKg: 0 };
    cur.count += 1;
    cur.volumeKg += s.volumeKg;
    byDate.set(key, cur);
  }

  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const daysBack = weeks * 7 - 1;
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);

  const cells: HeatmapCell[] = [];
  const volumes: number[] = [];
  for (let i = 0; i <= daysBack; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = todayKey(d);
    const raw = byDate.get(key);
    const count = raw?.count ?? 0;
    const volumeKg = Math.round(raw?.volumeKg ?? 0);
    if (count > 0) volumes.push(volumeKg);
    cells.push({ date: key, count, volumeKg, level: 0 });
  }

  const maxVol = volumes.length ? Math.max(...volumes) : 0;
  return cells.map((c) => {
    if (c.count === 0) return c;
    if (maxVol <= 0) return { ...c, level: 1 as const };
    const ratio = c.volumeKg / maxVol;
    const level = (ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4) as 1 | 2 | 3 | 4;
    return { ...c, level };
  });
}

export interface ExerciseLoadPoint {
  date: string;
  label: string;
  maxWeightKg: number;
  volumeKg: number;
}

export function exerciseLoadSeries(sessions: SessionLog[], exerciseId: string): ExerciseLoadPoint[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const out: ExerciseLoadPoint[] = [];
  for (const session of sorted) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const done = ex.sets.filter((s) => s.done);
    if (!done.length) continue;
    const maxWeightKg = Math.max(...done.map((s) => s.weightKg));
    const volumeKg = Math.round(done.reduce((sum, s) => sum + s.reps * s.weightKg, 0));
    out.push({
      date: session.date.slice(0, 10),
      label: new Date(session.date.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      maxWeightKg,
      volumeKg,
    });
  }
  return out;
}

export function topExercisesBySessions(sessions: SessionLog[], limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (!ex.sets.some((s) => s.done)) continue;
      counts.set(ex.exerciseId, (counts.get(ex.exerciseId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

/** All-time PRs whose record date falls in the current calendar week (Mon–Sun). */
export function prsInCurrentWeek(sessions: SessionLog[]) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Mon=0
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const weekStart = todayKey(monday);
  const weekEnd = todayKey(sunday);

  return personalRecords(sessions).filter((r) => {
    const d = r.date.slice(0, 10);
    return d >= weekStart && d <= weekEnd;
  });
}
