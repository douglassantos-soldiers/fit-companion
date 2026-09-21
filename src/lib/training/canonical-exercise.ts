/**
 * Canonical exercise domain — one definition for seed, overlay, planner, media, admin.
 * Lote 1 is Soldiers-authored; third-party catalogs are not imported.
 */
import type { Exercise, Joint, MuscleGroup } from "@/data/exercises";
import type { AnimationSpec } from "@/lib/soldiers-media-types";
import type { GymGear } from "@/lib/types";

export const CANONICAL_MOVEMENT_PATTERNS = [
  "press",
  "pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "rotation",
  "anti_rotation",
  "raise",
  "curl",
  "extension",
  "cardio",
  "isometric",
  "mobility",
] as const;

export type CanonicalMovementPattern = (typeof CANONICAL_MOVEMENT_PATTERNS)[number];

/** Transitional aliases from lote 1 seed literals. Resolver stores the canonical value. */
export const LEGACY_MOVEMENT_ALIASES = {
  fly: "raise",
  carry_iso: "isometric",
  other: "mobility",
} as const;

export type LegacyMovementAlias = keyof typeof LEGACY_MOVEMENT_ALIASES;
export type LegacyMovementPattern = CanonicalMovementPattern | LegacyMovementAlias;

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "peito",
  "costas",
  "pernas",
  "ombros",
  "biceps",
  "triceps",
  "core",
  "cardio",
];

export const EQUIPMENT_VALUES: Exercise["equipment"][] = ["casa", "academia", "ambos"];

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MEDIA_STATUSES = ["missing", "poster", "motion", "published"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const GYM_GEAR_VALUES: GymGear[] = [
  "barra",
  "halteres",
  "maquinas",
  "elasticos",
  "peso_corporal",
  "cabos",
  "kettlebell",
  "cardio",
];

export const DEFAULT_ANIMATION_SPEC: AnimationSpec = {
  tempo: "controlled",
  durationSec: 4,
  loop: true,
  camera: "three-quarter",
  start: "posição inicial",
  end: "posição final",
};

export interface CanonicalExercise {
  id: string;
  canonicalName: string;
  displayNamePt: string;
  /** Adapter alias of displayNamePt (planner / admin / existing imports). */
  name: string;
  version: number;
  group: MuscleGroup;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  movementPattern: CanonicalMovementPattern;
  equipment: Exercise["equipment"];
  joints: Joint[];
  difficulty: Difficulty;
  unit: Exercise["unit"];
  swapGroup: string;
  baseLoad: number;
  priority: number;
  plannerEligible: boolean;
  active: boolean;
  instructions: string[];
  alternativeIds: string[];
  mediaId: string;
  mediaStatus: MediaStatus;
  animationSpec: AnimationSpec;
  displayNameEn?: string;
  equipmentInventory?: GymGear[];
  cues?: string[];
  aliases?: string[];
  searchTerms?: string[];
  exerciseFamily?: string;
  movementFamily?: string;
  progressionFamily?: string;
  regressionFamily?: string;
  contraindicationTags?: string[];
  videoUrl?: string;
  mediaUrl?: string;
}

export type LibraryExerciseInput = CanonicalExercise;

export function isCanonicalMovementPattern(value: string): value is CanonicalMovementPattern {
  return (CANONICAL_MOVEMENT_PATTERNS as readonly string[]).includes(value);
}

export function normalizeMovementPattern(
  raw: string | null | undefined,
  fallback: CanonicalMovementPattern = "mobility",
): CanonicalMovementPattern {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!key) return fallback;
  if (key in LEGACY_MOVEMENT_ALIASES) {
    return LEGACY_MOVEMENT_ALIASES[key as LegacyMovementAlias];
  }
  if (isCanonicalMovementPattern(key)) return key;
  return fallback;
}

export function isValidMuscleGroup(value: string): value is MuscleGroup {
  return (MUSCLE_GROUPS as string[]).includes(value);
}

export function isValidEquipment(value: string): value is Exercise["equipment"] {
  return (EQUIPMENT_VALUES as string[]).includes(value);
}

function optionalText(value: string | null | undefined): string | undefined {
  const t = (value ?? "").trim();
  return t ? t : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter(Boolean);
}

function asCues(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const next = value.map((x) => String(x).trim()).filter(Boolean);
    return next.length ? next : undefined;
  }
  if (typeof value === "string") {
    const parts = value
      .split(/\n|\|/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }
  return undefined;
}

function asMediaStatus(value: unknown, fallback: MediaStatus): MediaStatus {
  return typeof value === "string" && (MEDIA_STATUSES as readonly string[]).includes(value)
    ? (value as MediaStatus)
    : fallback;
}

function asGear(value: unknown): GymGear[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const next = value.filter(
    (x): x is GymGear => typeof x === "string" && GYM_GEAR_VALUES.includes(x as GymGear),
  );
  return next.length ? next : undefined;
}

function asAnimationSpec(value: unknown, fallback: AnimationSpec): AnimationSpec {
  if (!value || typeof value !== "object") return fallback;
  const v = value as Partial<AnimationSpec>;
  const start = v.start;
  const end = v.end;
  const tempo = v.tempo;
  const durationSec = v.durationSec;
  const loop = v.loop;
  const camera = v.camera;
  return {
    start: typeof start === "string" && start.trim() ? start : fallback.start,
    end: typeof end === "string" && end.trim() ? end : fallback.end,
    tempo:
      tempo === "controlled" || tempo === "explosive" || tempo === "hold" ? tempo : fallback.tempo,
    durationSec:
      typeof durationSec === "number" && Number.isFinite(durationSec)
        ? durationSec
        : fallback.durationSec,
    loop: typeof loop === "boolean" ? loop : fallback.loop,
    camera:
      camera === "three-quarter" || camera === "side" || camera === "front"
        ? camera
        : fallback.camera,
  };
}

/** Input may include undefined optionals (spreads / overlays). Output omits them. */
export type CanonicalDraft = {
  id: string;
  name?: string | undefined;
  canonicalName?: string | undefined;
  displayNamePt?: string | undefined;
  displayNameEn?: string | undefined;
  version?: number | undefined;
  group?: MuscleGroup | undefined;
  primaryMuscles?: MuscleGroup[] | undefined;
  secondaryMuscles?: MuscleGroup[] | undefined;
  movementPattern?: string | undefined;
  equipment?: Exercise["equipment"] | undefined;
  joints?: Joint[] | undefined;
  difficulty?: Difficulty | undefined;
  unit?: Exercise["unit"] | undefined;
  swapGroup?: string | undefined;
  baseLoad?: number | undefined;
  priority?: number | undefined;
  plannerEligible?: boolean | undefined;
  active?: boolean | undefined;
  instructions?: string[] | undefined;
  alternativeIds?: string[] | undefined;
  mediaId?: string | undefined;
  mediaStatus?: MediaStatus | string | undefined;
  animationSpec?: AnimationSpec | undefined;
  equipmentInventory?: GymGear[] | undefined;
  cues?: string[] | string | undefined;
  aliases?: string[] | undefined;
  searchTerms?: string[] | undefined;
  exerciseFamily?: string | undefined;
  movementFamily?: string | undefined;
  progressionFamily?: string | undefined;
  regressionFamily?: string | undefined;
  contraindicationTags?: string[] | undefined;
  videoUrl?: string | undefined;
  mediaUrl?: string | undefined;
};

/**
 * Fill canonical defaults. Existing lote 1 rows do not need per-field rewrites.
 */
export function toCanonicalExercise(seed: CanonicalDraft): CanonicalExercise {
  const id = String(seed.id ?? "").trim();
  const displayNamePt = optionalText(seed.displayNamePt) ?? optionalText(seed.name) ?? id;
  const group = seed.group && isValidMuscleGroup(seed.group) ? seed.group : "peito";
  const equipment = seed.equipment && isValidEquipment(seed.equipment) ? seed.equipment : "ambos";
  const animationSpec = asAnimationSpec(seed.animationSpec, {
    ...DEFAULT_ANIMATION_SPEC,
  });
  const row: CanonicalExercise = {
    id,
    canonicalName: optionalText(seed.canonicalName) ?? id,
    displayNamePt,
    name: displayNamePt,
    version: typeof seed.version === "number" && seed.version > 0 ? Math.round(seed.version) : 1,
    group,
    primaryMuscles:
      Array.isArray(seed.primaryMuscles) && seed.primaryMuscles.length
        ? seed.primaryMuscles.filter(isValidMuscleGroup)
        : [group],
    secondaryMuscles: Array.isArray(seed.secondaryMuscles)
      ? seed.secondaryMuscles.filter(isValidMuscleGroup)
      : [],
    movementPattern: normalizeMovementPattern(seed.movementPattern),
    equipment,
    joints: Array.isArray(seed.joints) ? seed.joints : [],
    difficulty:
      seed.difficulty === "beginner" ||
      seed.difficulty === "intermediate" ||
      seed.difficulty === "advanced"
        ? seed.difficulty
        : "intermediate",
    unit: seed.unit === "corpo" || seed.unit === "min" ? seed.unit : "kg",
    swapGroup: optionalText(seed.swapGroup) ?? group,
    baseLoad:
      typeof seed.baseLoad === "number" && Number.isFinite(seed.baseLoad) ? seed.baseLoad : 20,
    priority: typeof seed.priority === "number" ? seed.priority : 2,
    plannerEligible: seed.plannerEligible !== false,
    active: seed.active !== false,
    instructions: asStringArray(seed.instructions),
    alternativeIds: asStringArray(seed.alternativeIds),
    mediaId: optionalText(seed.mediaId) ?? id,
    mediaStatus: asMediaStatus(seed.mediaStatus, "missing"),
    animationSpec,
  };
  const displayNameEn = optionalText(seed.displayNameEn);
  if (displayNameEn) row.displayNameEn = displayNameEn;
  const inventory = asGear(seed.equipmentInventory);
  if (inventory) row.equipmentInventory = inventory;
  const cues = asCues(seed.cues);
  if (cues) row.cues = cues;
  const aliases = asStringArray(seed.aliases);
  if (aliases.length) row.aliases = aliases;
  const searchTerms = asStringArray(seed.searchTerms);
  if (searchTerms.length) row.searchTerms = searchTerms;
  const exerciseFamily = optionalText(seed.exerciseFamily);
  if (exerciseFamily) row.exerciseFamily = exerciseFamily;
  const movementFamily = optionalText(seed.movementFamily);
  if (movementFamily) row.movementFamily = movementFamily;
  const progressionFamily = optionalText(seed.progressionFamily);
  if (progressionFamily) row.progressionFamily = progressionFamily;
  const regressionFamily = optionalText(seed.regressionFamily);
  if (regressionFamily) row.regressionFamily = regressionFamily;
  const contraindicationTags = asStringArray(seed.contraindicationTags);
  if (contraindicationTags.length) row.contraindicationTags = contraindicationTags;
  const videoUrl = optionalText(seed.videoUrl);
  if (videoUrl) row.videoUrl = videoUrl;
  const mediaUrl = optionalText(seed.mediaUrl);
  if (mediaUrl) row.mediaUrl = mediaUrl;
  return row;
}

export function mediaEntityId(
  exercise: Pick<CanonicalExercise, "id" | "mediaId"> | string,
): string {
  if (typeof exercise === "string") return exercise;
  return exercise.mediaId || exercise.id;
}
