/**
 * Planner exercise pool — facade over the canonical library (lote 1).
 * EXERCISES is the active + plannerEligible projection; hydrate may replace it.
 */
import { EXERCISE_LIBRARY } from "@/data/exercise-library";
import { resolveExerciseMedia } from "@/lib/soldiers-media";

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

/** Alternativas para trocar na sessão: lista explícita do CMS, senão swapGroup/grupo. */
export function alternativesFor(
  exerciseId: string,
  equipment: "casa" | "academia",
  restrictions: string[] = [],
): Exercise[] {
  const current = exerciseById(exerciseId);
  if (!current) return [];
  const avoided = normalizeRestrictions(restrictions);
  const explicit = getAlternativeIds(exerciseId);

  if (explicit?.length) {
    return explicit
      .map((id) => exerciseById(id))
      .filter((e): e is Exercise => Boolean(e))
      .filter((e) => e.id !== exerciseId && matchesEquipment(e, equipment) && respectsJoints(e, avoided));
  }

  const pool = EXERCISES.filter(
    (e) =>
      e.id !== exerciseId &&
      matchesEquipment(e, equipment) &&
      respectsJoints(e, avoided) &&
      (e.swapGroup === current.swapGroup || e.group === current.group),
  );

  return pool.sort((a, b) => {
    const sameSwapA = a.swapGroup === current.swapGroup ? 0 : 1;
    const sameSwapB = b.swapGroup === current.swapGroup ? 0 : 1;
    if (sameSwapA !== sameSwapB) return sameSwapA - sameSwapB;
    return (a.priority ?? 99) - (b.priority ?? 99);
  });
}
