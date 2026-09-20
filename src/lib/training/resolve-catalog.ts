/**
 * Merge code catalog seeds with DB overlays. Pure — no I/O.
 */
import type { Exercise, Joint, MuscleGroup } from "@/data/exercises";
import type { LibraryExercise } from "@/data/exercise-library";
import type { Difficulty, MovementPattern } from "@/lib/training/exercise-catalog";
import type {
  Challenge,
  ChallengeCategory,
  ChallengeMetric,
} from "@/data/challenges";

const GROUPS: MuscleGroup[] = [
  "peito",
  "costas",
  "pernas",
  "ombros",
  "biceps",
  "triceps",
  "core",
  "cardio",
];
const JOINTS: Joint[] = ["joelho", "ombro", "lombar", "punho"];
const EQUIPMENT: Exercise["equipment"][] = ["casa", "academia", "ambos"];
const UNITS: Exercise["unit"][] = ["kg", "corpo", "min"];
const PATTERNS: MovementPattern[] = [
  "press",
  "pull",
  "squat",
  "hinge",
  "lunge",
  "fly",
  "raise",
  "curl",
  "extension",
  "carry_iso",
  "cardio",
  "other",
];
const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];

export type ExerciseOverlay = {
  id: string;
  name?: string;
  group?: MuscleGroup;
  equipment?: Exercise["equipment"];
  swapGroup?: string;
  joints?: Joint[];
  unit?: Exercise["unit"];
  baseLoad?: number;
  priority?: number;
  primaryMuscles?: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  movementPattern?: MovementPattern;
  difficulty?: Difficulty;
  plannerEligible?: boolean;
  active?: boolean;
  instructions?: string[];
  videoUrl?: string | null;
  mediaUrl?: string | null;
  cues?: string | null;
  alternativeIds?: string[];
};

export type ResolvedLibraryExercise = LibraryExercise & {
  alternativeIds: string[];
  videoUrl?: string;
  mediaUrl?: string;
  cues?: string;
};

const DEFAULT_ANIMATION: LibraryExercise["animationSpec"] = {
  tempo: "controlled",
  durationSec: 4,
  loop: true,
  camera: "three-quarter",
  start: "posição inicial",
  end: "posição final",
};

function asGroup(v: unknown, fallback: MuscleGroup): MuscleGroup {
  return typeof v === "string" && (GROUPS as string[]).includes(v) ? (v as MuscleGroup) : fallback;
}

function asGroups(v: unknown, fallback: MuscleGroup[]): MuscleGroup[] {
  if (!Array.isArray(v)) return fallback;
  const next = v.filter((x): x is MuscleGroup => typeof x === "string" && (GROUPS as string[]).includes(x));
  return next.length ? next : fallback;
}

function asJoints(v: unknown, fallback: Joint[]): Joint[] {
  if (!Array.isArray(v)) return fallback;
  return v.filter((x): x is Joint => typeof x === "string" && (JOINTS as string[]).includes(x));
}

function asEquipment(v: unknown, fallback: Exercise["equipment"]): Exercise["equipment"] {
  return typeof v === "string" && (EQUIPMENT as string[]).includes(v)
    ? (v as Exercise["equipment"])
    : fallback;
}

function asUnit(v: unknown, fallback: Exercise["unit"]): Exercise["unit"] {
  return typeof v === "string" && (UNITS as string[]).includes(v) ? (v as Exercise["unit"]) : fallback;
}

function asPattern(v: unknown, fallback: MovementPattern): MovementPattern {
  return typeof v === "string" && (PATTERNS as string[]).includes(v)
    ? (v as MovementPattern)
    : fallback;
}

function asDifficulty(v: unknown, fallback: Difficulty): Difficulty {
  return typeof v === "string" && (DIFFICULTIES as string[]).includes(v)
    ? (v as Difficulty)
    : fallback;
}

function optionalText(v: string | null | undefined): string | undefined {
  const t = (v ?? "").trim();
  return t ? t : undefined;
}

function newFromOverlay(o: ExerciseOverlay): ResolvedLibraryExercise | null {
  const name = (o.name ?? "").trim();
  if (!name) return null;
  const group = asGroup(o.group, "peito");
  const resolved: ResolvedLibraryExercise = {
    id: o.id,
    name,
    group,
    equipment: asEquipment(o.equipment, "ambos"),
    swapGroup: (o.swapGroup ?? group).trim() || group,
    joints: asJoints(o.joints, []),
    unit: asUnit(o.unit, "kg"),
    baseLoad: typeof o.baseLoad === "number" && Number.isFinite(o.baseLoad) ? o.baseLoad : 20,
    priority: typeof o.priority === "number" ? o.priority : 2,
    primaryMuscles: asGroups(o.primaryMuscles, [group]),
    secondaryMuscles: asGroups(o.secondaryMuscles, []),
    movementPattern: asPattern(o.movementPattern, "other"),
    difficulty: asDifficulty(o.difficulty, "intermediate"),
    plannerEligible: o.plannerEligible !== false,
    active: o.active !== false,
    instructions: Array.isArray(o.instructions) ? o.instructions.map(String) : [],
    animationSpec: { ...DEFAULT_ANIMATION },
    alternativeIds: Array.isArray(o.alternativeIds) ? o.alternativeIds.map(String) : [],
  };
  const videoUrl = optionalText(o.videoUrl);
  const mediaUrl = optionalText(o.mediaUrl);
  const cues = optionalText(o.cues);
  return {
    ...resolved,
    ...(videoUrl ? { videoUrl } : {}),
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(cues ? { cues } : {}),
  };
}

function applyOverlay(base: ResolvedLibraryExercise, o: ExerciseOverlay): ResolvedLibraryExercise {
  const group = o.group != null ? asGroup(o.group, base.group) : base.group;
  const videoUrl = o.videoUrl !== undefined ? optionalText(o.videoUrl) : base.videoUrl;
  const mediaUrl = o.mediaUrl !== undefined ? optionalText(o.mediaUrl) : base.mediaUrl;
  const cues = o.cues !== undefined ? optionalText(o.cues) : base.cues;
  const next: ResolvedLibraryExercise = {
    ...base,
    name: o.name != null && o.name.trim() ? o.name.trim() : base.name,
    group,
    equipment: o.equipment != null ? asEquipment(o.equipment, base.equipment) : base.equipment,
    swapGroup: o.swapGroup != null ? o.swapGroup.trim() || base.swapGroup : base.swapGroup,
    joints: o.joints != null ? asJoints(o.joints, base.joints) : base.joints,
    unit: o.unit != null ? asUnit(o.unit, base.unit) : base.unit,
    baseLoad:
      typeof o.baseLoad === "number" && Number.isFinite(o.baseLoad) ? o.baseLoad : base.baseLoad,
    priority: typeof o.priority === "number" ? o.priority : base.priority,
    primaryMuscles: o.primaryMuscles != null ? asGroups(o.primaryMuscles, [group]) : base.primaryMuscles,
    secondaryMuscles:
      o.secondaryMuscles != null ? asGroups(o.secondaryMuscles, []) : base.secondaryMuscles,
    movementPattern:
      o.movementPattern != null ? asPattern(o.movementPattern, base.movementPattern) : base.movementPattern,
    difficulty: o.difficulty != null ? asDifficulty(o.difficulty, base.difficulty) : base.difficulty,
    plannerEligible: o.plannerEligible != null ? o.plannerEligible : base.plannerEligible,
    active: o.active != null ? o.active : base.active,
    instructions: o.instructions != null ? o.instructions.map(String) : base.instructions,
    alternativeIds: o.alternativeIds != null ? o.alternativeIds.map(String) : base.alternativeIds,
  };
  if (videoUrl) next.videoUrl = videoUrl;
  else delete next.videoUrl;
  if (mediaUrl) next.mediaUrl = mediaUrl;
  else delete next.mediaUrl;
  if (cues) next.cues = cues;
  else delete next.cues;
  return next;
}

export function mergeExercises(
  seed: LibraryExercise[],
  overlays: ExerciseOverlay[],
): ResolvedLibraryExercise[] {
  const map = new Map<string, ResolvedLibraryExercise>();
  for (const s of seed) {
    map.set(s.id, { ...s, instructions: [...s.instructions], alternativeIds: [] });
  }
  for (const o of overlays) {
    const id = String(o.id ?? "").trim();
    if (!id) continue;
    const prev = map.get(id);
    if (prev) map.set(id, applyOverlay(prev, { ...o, id }));
    else {
      const created = newFromOverlay({ ...o, id });
      if (created) map.set(id, created);
    }
  }
  return [...map.values()];
}

export function toPlannerExercises(resolved: ResolvedLibraryExercise[]): Exercise[] {
  return resolved
    .filter((e) => e.active && e.plannerEligible)
    .map((e) => {
      const mediaUrl = e.videoUrl || e.mediaUrl;
      const row: Exercise = {
        id: e.id,
        name: e.name,
        group: e.group,
        equipment: e.equipment,
        baseLoad: e.baseLoad,
        unit: e.unit,
        joints: e.joints,
        swapGroup: e.swapGroup,
        priority: e.priority,
      };
      return mediaUrl ? { ...row, mediaUrl } : row;
    });
}

export function alternativeMapFromResolved(
  resolved: ResolvedLibraryExercise[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of resolved) {
    if (e.alternativeIds.length) out[e.id] = e.alternativeIds;
  }
  return out;
}

export type ChallengeOverlay = {
  id: string;
  title?: string;
  description?: string;
  category?: ChallengeCategory;
  metric?: ChallengeMetric;
  target?: number;
  unit?: string;
  durationDays?: number;
  rankingMode?: Challenge["rankingMode"];
  reward?: string | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  requiresPerformance?: boolean;
  targetPct?: number;
  personalTargetMin?: number;
  personalTargetMax?: number;
  personalTargetFactor?: number;
  personalTargetOffset?: number;
  participants?: number;
};

export type ResolvedChallenge = Challenge & {
  active: boolean;
  reward?: string;
  startsAt?: string;
  endsAt?: string;
};

const CATEGORIES: ChallengeCategory[] = [
  "consistency",
  "transformation",
  "strength",
  "running",
  "steps",
  "football",
  "muscle_gain",
  "conditioning",
];
const METRICS: ChallengeMetric[] = [
  "sessoes",
  "volume",
  "dias",
  "cardio_sessions",
  "steps",
  "football_sessions",
  "activity_minutes",
  "volume_pull",
  "invites",
];
const MODES: NonNullable<Challenge["rankingMode"]>[] = ["absolute", "relative", "personalized"];

function asCategory(v: unknown, fb: ChallengeCategory): ChallengeCategory {
  return typeof v === "string" && (CATEGORIES as string[]).includes(v) ? (v as ChallengeCategory) : fb;
}
function asMetric(v: unknown, fb: ChallengeMetric): ChallengeMetric {
  return typeof v === "string" && (METRICS as string[]).includes(v) ? (v as ChallengeMetric) : fb;
}
function asMode(v: unknown, fb: NonNullable<Challenge["rankingMode"]>): NonNullable<Challenge["rankingMode"]> {
  return typeof v === "string" && (MODES as string[]).includes(v)
    ? (v as NonNullable<Challenge["rankingMode"]>)
    : fb;
}

function seedAsResolved(c: Challenge): ResolvedChallenge {
  const next: ResolvedChallenge = { ...c, active: true };
  return next;
}

function newChallenge(o: ChallengeOverlay): ResolvedChallenge | null {
  const title = (o.title ?? "").trim();
  if (!title) return null;
  const target = typeof o.target === "number" && Number.isFinite(o.target) ? o.target : 1;
  const durationDays =
    typeof o.durationDays === "number" && o.durationDays > 0 ? Math.round(o.durationDays) : 7;
  const row: ResolvedChallenge = {
    id: o.id,
    title,
    description: (o.description ?? "").trim(),
    category: asCategory(o.category, "consistency"),
    metric: asMetric(o.metric, "sessoes"),
    target,
    unit: (o.unit ?? "treinos").trim() || "treinos",
    durationDays,
    participants: typeof o.participants === "number" ? o.participants : 0,
    active: o.active !== false,
    rankingMode: asMode(o.rankingMode, "absolute"),
  };
  if (o.requiresPerformance) row.requiresPerformance = true;
  const reward = optionalText(o.reward);
  if (reward) row.reward = reward;
  const startsAt = optionalText(o.startsAt);
  if (startsAt) row.startsAt = startsAt;
  const endsAt = optionalText(o.endsAt);
  if (endsAt) row.endsAt = endsAt;
  if (typeof o.targetPct === "number") row.targetPct = o.targetPct;
  if (typeof o.personalTargetMin === "number") row.personalTargetMin = o.personalTargetMin;
  if (typeof o.personalTargetMax === "number") row.personalTargetMax = o.personalTargetMax;
  if (typeof o.personalTargetFactor === "number") row.personalTargetFactor = o.personalTargetFactor;
  if (typeof o.personalTargetOffset === "number") row.personalTargetOffset = o.personalTargetOffset;
  return row;
}

function applyChallenge(base: ResolvedChallenge, o: ChallengeOverlay): ResolvedChallenge {
  const next: ResolvedChallenge = { ...base };
  if (o.title != null && o.title.trim()) next.title = o.title.trim();
  if (o.description != null) next.description = o.description.trim();
  if (o.category != null) next.category = asCategory(o.category, next.category);
  if (o.metric != null) next.metric = asMetric(o.metric, next.metric);
  if (typeof o.target === "number" && Number.isFinite(o.target)) next.target = o.target;
  if (o.unit != null && o.unit.trim()) next.unit = o.unit.trim();
  if (typeof o.durationDays === "number" && o.durationDays > 0) {
    next.durationDays = Math.round(o.durationDays);
  }
  if (typeof o.participants === "number") next.participants = o.participants;
  if (o.active != null) next.active = o.active;
  if (o.rankingMode != null) next.rankingMode = asMode(o.rankingMode, next.rankingMode ?? "absolute");
  if (o.requiresPerformance != null) {
    if (o.requiresPerformance) next.requiresPerformance = true;
    else delete next.requiresPerformance;
  }
  if (o.reward !== undefined) {
    const reward = optionalText(o.reward);
    if (reward) next.reward = reward;
    else delete next.reward;
  }
  if (o.startsAt !== undefined) {
    const v = optionalText(o.startsAt);
    if (v) next.startsAt = v;
    else delete next.startsAt;
  }
  if (o.endsAt !== undefined) {
    const v = optionalText(o.endsAt);
    if (v) next.endsAt = v;
    else delete next.endsAt;
  }
  if (typeof o.targetPct === "number") next.targetPct = o.targetPct;
  if (typeof o.personalTargetMin === "number") next.personalTargetMin = o.personalTargetMin;
  if (typeof o.personalTargetMax === "number") next.personalTargetMax = o.personalTargetMax;
  if (typeof o.personalTargetFactor === "number") next.personalTargetFactor = o.personalTargetFactor;
  if (typeof o.personalTargetOffset === "number") next.personalTargetOffset = o.personalTargetOffset;
  return next;
}

export function mergeChallenges(
  seed: Challenge[],
  overlays: ChallengeOverlay[],
  participantCounts: Record<string, number> = {},
): ResolvedChallenge[] {
  const map = new Map<string, ResolvedChallenge>();
  for (const s of seed) {
    const row = seedAsResolved(s);
    const live = participantCounts[s.id];
    if (typeof live === "number") row.participants = live;
    map.set(s.id, row);
  }
  for (const o of overlays) {
    const id = String(o.id ?? "").trim();
    if (!id) continue;
    const prev = map.get(id);
    const withCount =
      typeof participantCounts[id] === "number"
        ? { ...o, id, participants: participantCounts[id] }
        : { ...o, id };
    if (prev) map.set(id, applyChallenge(prev, withCount));
    else {
      const created = newChallenge(withCount);
      if (created) map.set(id, created);
    }
  }
  return [...map.values()];
}

export function activeChallenges(resolved: ResolvedChallenge[]): Challenge[] {
  return resolved.filter((c) => c.active).map((c) => {
    const { active: _a, ...rest } = c;
    void _a;
    return rest;
  });
}
