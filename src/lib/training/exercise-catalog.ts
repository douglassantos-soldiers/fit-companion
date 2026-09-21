/**
 * Exercise catalog — view over the canonical resolved library.
 * Conceptual reference only (openGym / wger / GymMane); no licensed data copied.
 */
import {
  EXERCISES,
  alternativesFor,
  exerciseById,
  matchesEquipment,
  normalizeRestrictions,
  respectsJoints,
  type Exercise,
  type Joint,
  type MuscleGroup,
} from "@/data/exercises";
import { libraryById, resolvedLibrary } from "@/data/exercise-library";
import { resolveExerciseMedia } from "@/lib/soldiers-media";
import {
  normalizeMovementPattern,
  toCanonicalExercise,
  type CanonicalExercise,
  type CanonicalMovementPattern,
  type Difficulty,
} from "@/lib/training/canonical-exercise";

export type MovementPattern = CanonicalMovementPattern;
export type { Difficulty, CanonicalMovementPattern };

export interface CatalogExercise {
  id: string;
  name: string;
  group: MuscleGroup;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Exercise["equipment"];
  movementPattern: MovementPattern;
  difficulty: Difficulty;
  unit: Exercise["unit"];
  joints: Joint[];
  swapGroup: string;
  media?: string;
  instructions?: string;
  active: boolean;
  baseLoad: number;
  priority?: number;
}

function patternFromSwap(swapGroup: string): MovementPattern {
  if (swapGroup.includes("press")) return "press";
  if (swapGroup.includes("pull") || swapGroup.includes("row")) return "pull";
  if (swapGroup.includes("squat")) return "squat";
  if (swapGroup.includes("hinge")) return "hinge";
  if (swapGroup.includes("lunge")) return "lunge";
  if (swapGroup.includes("fly") || swapGroup.includes("raise")) return "raise";
  if (swapGroup.includes("curl")) return "curl";
  if (swapGroup.includes("ext")) return "extension";
  if (swapGroup.includes("iso") || swapGroup.includes("dyn")) return "isometric";
  if (swapGroup.includes("cardio")) return "cardio";
  return "mobility";
}

function difficultyFromPriority(priority?: number): Difficulty {
  if (priority == null || priority <= 1) return "intermediate";
  if (priority >= 3) return "beginner";
  return "intermediate";
}

function catalogFromCanonical(lib: CanonicalExercise): CatalogExercise {
  const media = resolveExerciseMedia(lib.id, lib.mediaUrl ?? lib.videoUrl);
  const mediaUrl = media.posterUrl ?? media.gifUrl ?? lib.mediaUrl ?? lib.videoUrl;
  const instructions = lib.instructions.join(" ");
  return {
    id: lib.id,
    name: lib.name,
    group: lib.group,
    primaryMuscles: lib.primaryMuscles.length ? lib.primaryMuscles : [lib.group],
    secondaryMuscles: lib.secondaryMuscles,
    equipment: lib.equipment,
    movementPattern: lib.movementPattern,
    difficulty: lib.difficulty,
    unit: lib.unit,
    joints: lib.joints,
    swapGroup: lib.swapGroup,
    ...(mediaUrl ? { media: mediaUrl } : {}),
    ...(instructions ? { instructions } : {}),
    active: lib.active,
    baseLoad: lib.baseLoad,
    ...(lib.priority != null ? { priority: lib.priority } : {}),
  };
}

export function normalizeExercise(ex: Exercise): CatalogExercise {
  const lib = libraryById(ex.id);
  if (lib) return catalogFromCanonical(toCanonicalExercise(lib));
  const fallback = toCanonicalExercise({
    id: ex.id,
    name: ex.name,
    group: ex.group,
    equipment: ex.equipment,
    swapGroup: ex.swapGroup,
    joints: ex.joints,
    unit: ex.unit,
    baseLoad: ex.baseLoad,
    priority: ex.priority ?? 2,
    movementPattern: patternFromSwap(ex.swapGroup),
    difficulty: difficultyFromPriority(ex.priority),
    plannerEligible: true,
    active: true,
    ...(ex.mediaUrl ? { mediaUrl: ex.mediaUrl } : {}),
  });
  return catalogFromCanonical(fallback);
}

/** Resolved live catalog (full library), not only the planner pool. */
export function catalogById(id: string): CatalogExercise | undefined {
  const lib = libraryById(id);
  if (lib) return catalogFromCanonical(toCanonicalExercise(lib));
  const ex = exerciseById(id);
  return ex ? normalizeExercise(ex) : undefined;
}

export function listCatalog(activeOnly = true): CatalogExercise[] {
  return resolvedLibrary()
    .filter((e) => e.plannerEligible)
    .filter((e) => (activeOnly ? e.active : true))
    .map((e) => catalogFromCanonical(toCanonicalExercise(e)));
}

export {
  EXERCISES,
  alternativesFor,
  exerciseById,
  matchesEquipment,
  normalizeRestrictions,
  respectsJoints,
};
export type { Exercise, Joint, MuscleGroup };
export { normalizeMovementPattern };
