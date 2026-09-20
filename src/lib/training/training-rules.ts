/**
 * Training program templates / level rules.
 * Code defaults are the seed; DB payload wins when present.
 */
import type { MuscleGroup } from "@/data/exercises";
import type { Goal, Level } from "@/lib/types";

export type SplitDay = { title: string; focus: string; groups: MuscleGroup[] };
export type GoalScheme = { sets: number; reps: string; restSec: number; loadFactor: number };

export type TrainingRules = {
  splits: Record<number, SplitDay[]>;
  goalScheme: Record<Goal, GoalScheme>;
  levelFactor: Record<Level, number>;
};

const MUSCLE_GROUPS: MuscleGroup[] = [
  "peito",
  "costas",
  "pernas",
  "ombros",
  "biceps",
  "triceps",
  "core",
  "cardio",
];

export const DEFAULT_SPLITS: Record<number, SplitDay[]> = {
  2: [
    { title: "Corpo inteiro A", focus: "Força geral", groups: ["pernas", "peito", "costas", "core"] },
    { title: "Corpo inteiro B", focus: "Força geral", groups: ["costas", "ombros", "pernas", "core"] },
  ],
  3: [
    { title: "Empurrar", focus: "Peito, ombros e tríceps", groups: ["peito", "ombros", "triceps"] },
    { title: "Puxar", focus: "Costas e bíceps", groups: ["costas", "biceps", "core"] },
    { title: "Pernas", focus: "Quadríceps, posterior e core", groups: ["pernas", "core"] },
  ],
  4: [
    { title: "Superior A", focus: "Peito e costas", groups: ["peito", "costas", "triceps"] },
    { title: "Inferior A", focus: "Pernas e core", groups: ["pernas", "core"] },
    { title: "Superior B", focus: "Ombros e braços", groups: ["ombros", "biceps", "triceps"] },
    { title: "Inferior B", focus: "Posterior e panturrilha", groups: ["pernas", "core"] },
  ],
  5: [
    { title: "Empurrar", focus: "Peito, ombros e tríceps", groups: ["peito", "ombros", "triceps"] },
    { title: "Puxar", focus: "Costas e bíceps", groups: ["costas", "biceps"] },
    { title: "Pernas", focus: "Força de membros inferiores", groups: ["pernas", "core"] },
    { title: "Superior", focus: "Volume de tronco", groups: ["peito", "costas", "ombros"] },
    { title: "Condicionamento", focus: "Cardio e core", groups: ["cardio", "core"] },
  ],
  6: [
    { title: "Empurrar A", focus: "Peito e tríceps", groups: ["peito", "triceps"] },
    { title: "Puxar A", focus: "Costas e bíceps", groups: ["costas", "biceps"] },
    { title: "Pernas A", focus: "Quadríceps", groups: ["pernas", "core"] },
    { title: "Empurrar B", focus: "Ombros e tríceps", groups: ["ombros", "triceps"] },
    { title: "Puxar B", focus: "Costas e core", groups: ["costas", "core"] },
    { title: "Pernas B", focus: "Posterior e condicionamento", groups: ["pernas", "cardio"] },
  ],
};

export const DEFAULT_GOAL_SCHEME: Record<Goal, GoalScheme> = {
  massa: { sets: 4, reps: "8-10", restSec: 90, loadFactor: 1 },
  gordura: { sets: 3, reps: "12-15", restSec: 45, loadFactor: 0.75 },
  performance: { sets: 5, reps: "5", restSec: 150, loadFactor: 1.15 },
  saude: { sets: 3, reps: "10-12", restSec: 60, loadFactor: 0.8 },
};

export const DEFAULT_LEVEL_FACTOR: Record<Level, number> = {
  iniciante: 0.6,
  intermediario: 1,
  avancado: 1.3,
};

export const DEFAULT_TRAINING_RULES: TrainingRules = {
  splits: DEFAULT_SPLITS,
  goalScheme: DEFAULT_GOAL_SCHEME,
  levelFactor: DEFAULT_LEVEL_FACTOR,
};

let current: TrainingRules = DEFAULT_TRAINING_RULES;

export function getTrainingRules(): TrainingRules {
  return current;
}

export function setTrainingRules(next: TrainingRules | null | undefined): void {
  current = next ?? DEFAULT_TRAINING_RULES;
}

function isMuscleGroup(v: unknown): v is MuscleGroup {
  return typeof v === "string" && (MUSCLE_GROUPS as string[]).includes(v);
}

function parseSplitDay(raw: unknown): SplitDay | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = String(o["title"] ?? "").trim();
  const focus = String(o["focus"] ?? "").trim();
  const groups = Array.isArray(o["groups"]) ? o["groups"].filter(isMuscleGroup) : [];
  if (!title || groups.length === 0) return null;
  return { title, focus: focus || title, groups };
}

function parseGoalScheme(raw: unknown, fallback: GoalScheme): GoalScheme {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const sets = Number(o["sets"]);
  const restSec = Number(o["restSec"]);
  const loadFactor = Number(o["loadFactor"]);
  const reps = String(o["reps"] ?? fallback.reps);
  return {
    sets: Number.isFinite(sets) && sets > 0 ? Math.round(sets) : fallback.sets,
    reps: reps.trim() || fallback.reps,
    restSec: Number.isFinite(restSec) && restSec >= 0 ? Math.round(restSec) : fallback.restSec,
    loadFactor: Number.isFinite(loadFactor) && loadFactor > 0 ? loadFactor : fallback.loadFactor,
  };
}

/** Merge a JSON payload over defaults. Empty/invalid payload → defaults. */
export function mergeTrainingRules(payload: unknown): TrainingRules {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return structuredClone(DEFAULT_TRAINING_RULES);
  }
  const raw = payload as Record<string, unknown>;
  const splitsSrc =
    raw["splits"] && typeof raw["splits"] === "object" && !Array.isArray(raw["splits"])
      ? (raw["splits"] as Record<string, unknown>)
      : {};
  const splits: Record<number, SplitDay[]> = {};
  for (const key of Object.keys(DEFAULT_SPLITS)) {
    const days = Number(key);
    const incoming = splitsSrc[key];
    if (Array.isArray(incoming)) {
      const parsed = incoming.map(parseSplitDay).filter((d): d is SplitDay => Boolean(d));
      splits[days] = parsed.length ? parsed : structuredClone(DEFAULT_SPLITS[days]!);
    } else {
      splits[days] = structuredClone(DEFAULT_SPLITS[days]!);
    }
  }

  const schemeSrc =
    raw["goalScheme"] && typeof raw["goalScheme"] === "object"
      ? (raw["goalScheme"] as Record<string, unknown>)
      : {};
  const goalScheme = {
    massa: parseGoalScheme(schemeSrc["massa"], DEFAULT_GOAL_SCHEME.massa),
    gordura: parseGoalScheme(schemeSrc["gordura"], DEFAULT_GOAL_SCHEME.gordura),
    performance: parseGoalScheme(schemeSrc["performance"], DEFAULT_GOAL_SCHEME.performance),
    saude: parseGoalScheme(schemeSrc["saude"], DEFAULT_GOAL_SCHEME.saude),
  };

  const factorSrc =
    raw["levelFactor"] && typeof raw["levelFactor"] === "object"
      ? (raw["levelFactor"] as Record<string, unknown>)
      : {};
  const parseFactor = (key: Level) => {
    const n = Number(factorSrc[key]);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_LEVEL_FACTOR[key];
  };
  const levelFactor = {
    iniciante: parseFactor("iniciante"),
    intermediario: parseFactor("intermediario"),
    avancado: parseFactor("avancado"),
  };

  return { splits, goalScheme, levelFactor };
}
