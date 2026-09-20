/**
 * Exercise catalog — enriched view over the planner pool (lote 1 library).
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
import { libraryById } from "@/data/exercise-library";
import { resolveExerciseMedia } from "@/lib/soldiers-media";

export type MovementPattern =
  | "press"
  | "pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "fly"
  | "raise"
  | "curl"
  | "extension"
  | "carry_iso"
  | "cardio"
  | "other";

export type Difficulty = "beginner" | "intermediate" | "advanced";

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

/** Secondary muscle hints by swapGroup (product heuristic, not clinical). */
const SECONDARY_BY_SWAP: Record<string, MuscleGroup[]> = {
  "peito-press": ["triceps", "ombros"],
  "peito-fly": ["ombros"],
  "costas-pull": ["biceps"],
  "costas-row": ["biceps", "core"],
  "perna-squat": ["core"],
  "perna-lunge": ["core"],
  "perna-hinge": ["core"],
  "ombro-press": ["triceps"],
  "ombro-raise": [],
  "biceps-curl": [],
  "triceps-ext": [],
  "core-iso": [],
  "core-dyn": [],
  "cardio-steady": [],
  "cardio-hiit": [],
  "perna-calf": [],
};

function patternFromSwap(swapGroup: string): MovementPattern {
  if (swapGroup.includes("press")) return "press";
  if (swapGroup.includes("pull") || swapGroup.includes("row")) return "pull";
  if (swapGroup.includes("squat")) return "squat";
  if (swapGroup.includes("hinge")) return "hinge";
  if (swapGroup.includes("lunge")) return "lunge";
  if (swapGroup.includes("fly")) return "fly";
  if (swapGroup.includes("raise")) return "raise";
  if (swapGroup.includes("curl")) return "curl";
  if (swapGroup.includes("ext")) return "extension";
  if (swapGroup.includes("iso") || swapGroup.includes("dyn")) return "carry_iso";
  if (swapGroup.includes("cardio")) return "cardio";
  return "other";
}

function difficultyFromPriority(priority?: number): Difficulty {
  if (priority == null || priority <= 1) return "intermediate";
  if (priority >= 3) return "beginner";
  return "intermediate";
}

export function normalizeExercise(ex: Exercise): CatalogExercise {
  const lib = libraryById(ex.id);
  const secondary =
    lib?.secondaryMuscles ?? (SECONDARY_BY_SWAP[ex.swapGroup] ?? []).filter((m) => m !== ex.group);
  const media = resolveExerciseMedia(ex.id, ex.mediaUrl);
  const mediaUrl = media.posterUrl ?? media.gifUrl ?? ex.mediaUrl;
  const instructions = lib?.instructions?.join(" ");
  return {
    id: ex.id,
    name: ex.name,
    group: ex.group,
    primaryMuscles: lib?.primaryMuscles ?? [ex.group],
    secondaryMuscles: secondary,
    equipment: ex.equipment,
    movementPattern: lib?.movementPattern ?? patternFromSwap(ex.swapGroup),
    difficulty: lib?.difficulty ?? difficultyFromPriority(ex.priority),
    unit: ex.unit,
    joints: ex.joints,
    swapGroup: ex.swapGroup,
    ...(mediaUrl ? { media: mediaUrl } : {}),
    ...(instructions ? { instructions } : {}),
    active: true,
    baseLoad: ex.baseLoad,
    ...(ex.priority != null ? { priority: ex.priority } : {}),
  };
}

export function catalogById(id: string): CatalogExercise | undefined {
  const ex = exerciseById(id);
  return ex ? normalizeExercise(ex) : undefined;
}

export function listCatalog(activeOnly = true): CatalogExercise[] {
  return EXERCISES.map(normalizeExercise).filter((e) => (activeOnly ? e.active : true));
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
