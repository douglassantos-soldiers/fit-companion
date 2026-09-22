/**
 * Strength Score — relative strength from estimated 1RM / bodyweight.
 * Deterministic, client-side; coexists with Performance Score (does not replace it).
 */
import { exerciseById } from "@/data/exercises";
import { catalogById } from "@/lib/training/exercise-catalog";
import { best1RM, exerciseStrengthTrend, type StrengthTrend } from "@/lib/training/one-rm";
import { hitsForExercise, listExercisesWithHistory } from "@/lib/engine/exercise-history";
import { sessionsInLastDays } from "@/lib/engine/dimensions";
import type { Level, Profile, SessionLog } from "@/lib/types";

export type StrengthPillar = "press" | "pull" | "squat" | "hinge" | "overhead";

export interface StrengthLiftScore {
  exerciseId: string;
  name: string;
  pillar: StrengthPillar;
  estimated1rm: number;
  relativeBw: number;
  score: number;
  trend: StrengthTrend;
}

export interface StrengthScoreResult {
  score: number;
  delta28d: number | null;
  lifts: StrengthLiftScore[];
  evidenceCount: number;
  coldStart: boolean;
}

/** 1RM / BW anchors: beginner → elite maps to ~40–100. */
const STANDARDS: Record<StrengthPillar, { beginner: number; elite: number; weight: number }> = {
  press: { beginner: 0.5, elite: 1.75, weight: 1.1 },
  pull: { beginner: 0.5, elite: 1.75, weight: 1.1 },
  squat: { beginner: 0.75, elite: 2.25, weight: 1.2 },
  hinge: { beginner: 1.0, elite: 2.5, weight: 1.2 },
  overhead: { beginner: 0.35, elite: 1.1, weight: 0.9 },
};

const COMPOUND_PATTERNS = new Set(["press", "pull", "squat", "hinge"]);
const MAX_LIFTS = 5;

function clampScore(n: number) {
  return Math.max(5, Math.min(100, Math.round(n)));
}

function pillarForExercise(exerciseId: string): StrengthPillar | null {
  const cat = catalogById(exerciseId);
  const ex = exerciseById(exerciseId);
  const swap = (cat?.swapGroup ?? ex?.swapGroup ?? "").toLowerCase();
  const pattern = cat?.movementPattern;
  const group = cat?.group ?? ex?.group;

  if (swap.includes("ombro") && swap.includes("press")) return "overhead";
  if (pattern === "press" || swap.includes("press")) {
    if (group === "ombros" || swap.startsWith("ombro")) return "overhead";
    return "press";
  }
  if (pattern === "pull" || swap.includes("pull") || swap.includes("row")) return "pull";
  if (pattern === "squat" || swap.includes("squat")) return "squat";
  if (pattern === "hinge" || swap.includes("hinge")) return "hinge";
  return null;
}

function isCompoundEligible(exerciseId: string): boolean {
  const cat = catalogById(exerciseId);
  const ex = exerciseById(exerciseId);
  if (!ex && !cat) return false;
  if ((cat?.unit ?? ex?.unit) === "corpo" || (cat?.unit ?? ex?.unit) === "min") return false;
  const pillar = pillarForExercise(exerciseId);
  if (!pillar) return false;
  const pattern = cat?.movementPattern;
  if (pattern && !COMPOUND_PATTERNS.has(pattern) && pillar !== "overhead") return false;
  // Prefer primary compounds: skip isolation-ish patterns when pattern known
  if (pattern === "raise" || pattern === "curl" || pattern === "extension" || pattern === "lunge") {
    return false;
  }
  return true;
}

function relativeToScore(pillar: StrengthPillar, relativeBw: number): number {
  const { beginner, elite } = STANDARDS[pillar];
  if (relativeBw <= 0) return 5;
  const t = (relativeBw - beginner) / Math.max(0.01, elite - beginner);
  return clampScore(40 + 60 * Math.max(0, Math.min(1.15, t)));
}

function trendAdjust(trend: StrengthTrend): number {
  if (trend === "up") return 3;
  if (trend === "down") return -3;
  return 0;
}

function coldStartScore(level: Level | undefined, sessions: SessionLog[]): number {
  const base = level === "avancado" ? 58 : level === "intermediario" ? 48 : 35;
  const volume = sessionsInLastDays(sessions, 28).reduce((s, x) => s + x.volumeKg, 0);
  return clampScore(base + Math.min(15, volume / 1000));
}

function scoreFromSessions(
  sessions: SessionLog[],
  bodyweightKg: number,
  level?: Level,
): Omit<StrengthScoreResult, "delta28d"> {
  const bw = bodyweightKg > 0 ? bodyweightKg : 75;
  const history = listExercisesWithHistory(sessions, 40);
  const candidates = history.filter((h) => isCompoundEligible(h.exerciseId) && h.hits.length > 0);

  const byPillar = new Map<StrengthPillar, StrengthLiftScore>();

  for (const summary of candidates) {
    const pillar = pillarForExercise(summary.exerciseId);
    if (!pillar) continue;
    const hits = hitsForExercise(summary.exerciseId, sessions);
    const best = best1RM(hits);
    if (!best || best.value <= 0) continue;
    const relativeBw = best.value / bw;
    const trend = exerciseStrengthTrend(hits);
    const score = clampScore(relativeToScore(pillar, relativeBw) + trendAdjust(trend));
    const lift: StrengthLiftScore = {
      exerciseId: summary.exerciseId,
      name: summary.name,
      pillar,
      estimated1rm: best.value,
      relativeBw: Math.round(relativeBw * 100) / 100,
      score,
      trend,
    };
    const prev = byPillar.get(pillar);
    if (!prev || lift.estimated1rm > prev.estimated1rm) {
      byPillar.set(pillar, lift);
    }
  }

  const lifts = [...byPillar.values()]
    .sort((a, b) => STANDARDS[b.pillar].weight - STANDARDS[a.pillar].weight)
    .slice(0, MAX_LIFTS);

  const evidenceCount = lifts.length;
  if (evidenceCount < 2) {
    return {
      score: coldStartScore(level, sessions),
      lifts,
      evidenceCount,
      coldStart: true,
    };
  }

  let weightSum = 0;
  let scoreSum = 0;
  for (const lift of lifts) {
    const w = STANDARDS[lift.pillar].weight;
    weightSum += w;
    scoreSum += lift.score * w;
  }
  return {
    score: clampScore(scoreSum / weightSum),
    lifts,
    evidenceCount,
    coldStart: false,
  };
}

export function computeStrengthScore(
  sessions: SessionLog[],
  profile: Pick<Profile, "weightKg" | "level"> | null | undefined,
  now = new Date(),
): StrengthScoreResult {
  const bw = profile?.weightKg ?? 75;
  const level = profile?.level;
  const current = scoreFromSessions(sessions, bw, level);

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 28);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const priorSessions = sessions.filter((s) => s.date.slice(0, 10) < cutoffKey);
  let delta28d: number | null = null;
  if (priorSessions.length >= 2 && current.evidenceCount >= 2) {
    const prior = scoreFromSessions(priorSessions, bw, level);
    if (!prior.coldStart) {
      delta28d = current.score - prior.score;
    }
  }

  return { ...current, delta28d };
}
