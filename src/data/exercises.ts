/**
 * Planner exercise pool — facade over the canonical library (lote 1).
 * EXERCISES is the active + plannerEligible projection; hydrate may replace it.
 */
import { EXERCISE_LIBRARY } from "@/data/exercise-library";
import { resolveExerciseMedia } from "@/lib/soldiers-media";
import { isPreferred } from "@/lib/training/preferences";
import type { ExercisePreferenceValue } from "@/lib/types";

export type MuscleGroup =
  | "peito"
  | "costas"
  | "pernas"
  | "ombros"
  | "biceps"
  | "triceps"
  | "core"
  | "cardio";

export type Joint = "joelho" | "ombro" | "lombar" | "punho";

export interface Exercise {
  id: string;
  name: string;
  group: MuscleGroup;
  equipment: "casa" | "academia" | "ambos";
  baseLoad: number;
  unit: "kg" | "corpo" | "min";
  joints: Joint[];
  swapGroup: string;
  priority?: number;
  /** Optional future demo image/GIF URL */
  mediaUrl?: string;
}

export interface AlternativesForOpts {
  preferences?: Record<string, ExercisePreferenceValue>;
  preferPublishedMedia?: boolean;
  /** When machine is busy, prefer free-weight / bodyweight alternatives. */
  preferNonMachine?: boolean;
}

function plannerFromLibrary(): Exercise[] {
  return EXERCISE_LIBRARY.filter((e) => e.active && e.plannerEligible).map((e) => ({
    id: e.id,
    name: e.name,
    group: e.group,
    equipment: e.equipment,
    baseLoad: e.baseLoad,
    unit: e.unit,
    joints: e.joints,
    swapGroup: e.swapGroup,
    priority: e.priority,
  }));
}

export const EXERCISES: Exercise[] = plannerFromLibrary();

let alternativeIds: Record<string, string[]> = {};

export function replacePlannerExercises(next: Exercise[]): void {
  EXERCISES.length = 0;
  EXERCISES.push(...next);
}

export function setAlternativeIds(next: Record<string, string[]>): void {
  alternativeIds = next;
}

export function getAlternativeIds(exerciseId: string): string[] | undefined {
  const ids = alternativeIds[exerciseId];
  return ids?.length ? ids : undefined;
}

export const exerciseById = (id: string) => {
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) return undefined;
  const media = resolveExerciseMedia(id, ex.mediaUrl);
  const mediaUrl = media.webmUrl || media.mp4Url || media.gifUrl || media.posterUrl;
  if (mediaUrl && mediaUrl !== ex.mediaUrl) return { ...ex, mediaUrl };
  if (mediaUrl && !ex.mediaUrl) return { ...ex, mediaUrl };
  return ex;
};

export function normalizeRestrictions(restrictions: string[]): Joint[] {
  const map: Record<string, Joint> = {
    joelho: "joelho",
    ombro: "ombro",
    lombar: "lombar",
    punho: "punho",
  };
  return restrictions
    .map((r) => map[r.trim().toLowerCase()])
    .filter((j): j is Joint => Boolean(j));
}

export function matchesEquipment(ex: Exercise, equipment: "casa" | "academia") {
  return ex.equipment === "ambos" || ex.equipment === equipment;
}

export function respectsJoints(ex: Exercise, avoided: Joint[]) {
  if (!avoided.length) return true;
  return !ex.joints.some((j) => avoided.includes(j));
}

function hasPublishedMedia(exerciseId: string): boolean {
  return resolveExerciseMedia(exerciseId).source === "soldiers";
}

function looksLikeMachine(ex: Exercise): boolean {
  const id = ex.id.toLowerCase();
  const name = ex.name.toLowerCase();
  return (
    id.includes("maquina") ||
    id.includes("smith") ||
    id.includes("hack") ||
    id.includes("leg-press") ||
    id.includes("crossover") ||
    name.includes("máquina") ||
    name.includes("smith")
  );
}

/** Alternativas para trocar na sessão: lista explícita do CMS, senão swapGroup/grupo. */
export function alternativesFor(
  exerciseId: string,
  equipment: "casa" | "academia",
  restrictions: string[] = [],
  opts: AlternativesForOpts = {},
): Exercise[] {
  const current = exerciseById(exerciseId);
  if (!current) return [];
  const avoided = normalizeRestrictions(restrictions);
  const explicit = getAlternativeIds(exerciseId);
  const preferMedia = opts.preferPublishedMedia !== false;
  const preferNonMachine = opts.preferNonMachine === true;

  const equipOk = (e: Exercise) => matchesEquipment(e, equipment);

  let pool: Exercise[];
  if (explicit?.length) {
    pool = explicit
      .map((id) => exerciseById(id))
      .filter((e): e is Exercise => Boolean(e))
      .filter((e) => e.id !== exerciseId && equipOk(e) && respectsJoints(e, avoided));
  } else {
    pool = EXERCISES.filter(
      (e) =>
        e.id !== exerciseId &&
        equipOk(e) &&
        respectsJoints(e, avoided) &&
        (e.swapGroup === current.swapGroup || e.group === current.group),
    );
  }

  return pool.sort((a, b) => {
    const sameSwapA = a.swapGroup === current.swapGroup ? 0 : 1;
    const sameSwapB = b.swapGroup === current.swapGroup ? 0 : 1;
    if (sameSwapA !== sameSwapB) return sameSwapA - sameSwapB;
    if (preferNonMachine) {
      const machA = looksLikeMachine(a) ? 1 : 0;
      const machB = looksLikeMachine(b) ? 1 : 0;
      if (machA !== machB) return machA - machB;
    }
    if (preferMedia) {
      const mediaA = hasPublishedMedia(a.id) ? 0 : 1;
      const mediaB = hasPublishedMedia(b.id) ? 0 : 1;
      if (mediaA !== mediaB) return mediaA - mediaB;
    }
    if (opts.preferences) {
      const prefA = isPreferred(opts.preferences, a.id) ? 0 : 1;
      const prefB = isPreferred(opts.preferences, b.id) ? 0 : 1;
      if (prefA !== prefB) return prefA - prefB;
    }
    return (a.priority ?? 99) - (b.priority ?? 99);
  });
}

/** Build explicit alternative_ids from dense swapGroups (machine/compound families). */
export function buildSwapGroupAlternatives(pool: Exercise[] = EXERCISES): Record<string, string[]> {
  const DENSE = new Set([
    "peito-press",
    "peito-fly",
    "costas-pull",
    "costas-row",
    "perna-squat",
    "perna-hinge",
    "perna-lunge",
    "ombro-press",
    "ombro-raise",
    "triceps-ext",
    "biceps-curl",
  ]);
  const byGroup = new Map<string, string[]>();
  for (const ex of pool) {
    if (!DENSE.has(ex.swapGroup)) continue;
    const list = byGroup.get(ex.swapGroup) ?? [];
    list.push(ex.id);
    byGroup.set(ex.swapGroup, list);
  }
  const map: Record<string, string[]> = {};
  for (const [, ids] of byGroup) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      map[id] = ids.filter((x) => x !== id).slice(0, 8);
    }
  }
  return map;
}

/** Seed runtime alternatives; CMS hydrate may merge/override later. */
export function seedSwapGroupAlternatives(pool: Exercise[] = EXERCISES): Record<string, string[]> {
  const map = buildSwapGroupAlternatives(pool);
  setAlternativeIds(map);
  return map;
}

seedSwapGroupAlternatives();
