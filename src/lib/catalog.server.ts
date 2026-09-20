/**
 * Catalog / CMS / training-rules persistence (service_role).
 */
import { adminDbLoose } from "@/lib/db-admin";
import { ADMIN_ACTOR, writeAudit } from "@/lib/admin.server";
import type { ExerciseOverlay, ChallengeOverlay, ResolvedLibraryExercise } from "@/lib/training/resolve-catalog";
import { mergeExercises, mergeChallenges } from "@/lib/training/resolve-catalog";
import { EXERCISE_LIBRARY } from "@/data/exercise-library";
import { CHALLENGES_SEED } from "@/data/challenges";
import { mergeTrainingRules, type TrainingRules } from "@/lib/training/training-rules";
import type { PublicCatalog } from "@/lib/catalog-runtime";
import {
  extrasFromNutrientRows,
  foodItemFromCatalogRow,
  servingFromCatalogRow,
} from "@/lib/nutrition/catalog-hydrate";
import type { FoodItem, FoodServing, FoodSource } from "@/lib/nutrition/types";
import type { ContentKind, PublicContentItem } from "@/lib/content-match";
import type { MuscleGroup, Joint, Exercise } from "@/data/exercises";
import type { MovementPattern, Difficulty } from "@/lib/training/exercise-catalog";
import type { ChallengeCategory, ChallengeMetric } from "@/data/challenges";

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function rowToExerciseOverlay(row: Record<string, unknown>): ExerciseOverlay {
  const overlay: ExerciseOverlay = {
    id: String(row["id"] ?? ""),
    name: String(row["name"] ?? ""),
    group: row["muscle_group"] as MuscleGroup,
    equipment: row["equipment"] as Exercise["equipment"],
    swapGroup: String(row["swap_group"] ?? ""),
    joints: asStringArray(row["joints"]) as Joint[],
    unit: row["unit"] as Exercise["unit"],
    baseLoad: Number(row["base_load"] ?? 0),
    priority: Number(row["priority"] ?? 2),
    primaryMuscles: asStringArray(row["primary_muscles"]) as MuscleGroup[],
    secondaryMuscles: asStringArray(row["secondary_muscles"]) as MuscleGroup[],
    plannerEligible: row["planner_eligible"] !== false,
    active: row["active"] !== false,
    instructions: asStringArray(row["instructions"]),
    videoUrl: (row["video_url"] as string | null) ?? null,
    mediaUrl: (row["media_url"] as string | null) ?? null,
    cues: (row["cues"] as string | null) ?? null,
    alternativeIds: asStringArray(row["alternative_ids"]),
  };
  if (row["movement_pattern"]) overlay.movementPattern = row["movement_pattern"] as MovementPattern;
  if (row["difficulty"]) overlay.difficulty = row["difficulty"] as Difficulty;
  return overlay;
}

function rowToChallengeOverlay(row: Record<string, unknown>): ChallengeOverlay {
  const overlay: ChallengeOverlay = {
    id: String(row["id"] ?? ""),
    title: String(row["title"] ?? ""),
    description: String(row["description"] ?? ""),
    category: row["category"] as ChallengeCategory,
    metric: row["metric"] as ChallengeMetric,
    target: Number(row["target"] ?? 1),
    unit: String(row["unit"] ?? "treinos"),
    durationDays: Number(row["duration_days"] ?? 7),
    rankingMode: (row["ranking_mode"] as ChallengeOverlay["rankingMode"]) ?? "absolute",
    reward: (row["reward"] as string | null) ?? null,
    active: row["active"] !== false,
    startsAt: (row["starts_at"] as string | null) ?? null,
    endsAt: (row["ends_at"] as string | null) ?? null,
    requiresPerformance: Boolean(row["requires_performance"]),
  };
  if (row["target_pct"] != null) overlay.targetPct = Number(row["target_pct"]);
  if (row["personal_target_min"] != null) overlay.personalTargetMin = Number(row["personal_target_min"]);
  if (row["personal_target_max"] != null) overlay.personalTargetMax = Number(row["personal_target_max"]);
  if (row["personal_target_factor"] != null) overlay.personalTargetFactor = Number(row["personal_target_factor"]);
  if (row["personal_target_offset"] != null) overlay.personalTargetOffset = Number(row["personal_target_offset"]);
  return overlay;
}

function rowToContent(row: Record<string, unknown>): PublicContentItem {
  const media = row["media_url"] != null ? String(row["media_url"]) : "";
  const item: PublicContentItem = {
    id: String(row["id"] ?? ""),
    kind: row["kind"] as ContentKind,
    title: String(row["title"] ?? ""),
    body: String(row["body"] ?? ""),
    goals: asStringArray(row["goals"]),
    levels: asStringArray(row["levels"]),
    published: Boolean(row["published"]),
    sortOrder: Number(row["sort_order"] ?? 0),
  };
  if (media) item.mediaUrl = media;
  return item;
}

export async function loadPublicCatalogServer(): Promise<PublicCatalog> {
  const empty: PublicCatalog = {
    exercises: [],
    challenges: [],
    participantCounts: {},
    trainingRules: null,
    content: [],
    tacoLicenseVerified: false,
    tacoFoods: [],
    tacoServings: [],
  };
  const db = await adminDbLoose();
  if (!db) return empty;

  const [exRes, chRes, rulesRes, contentRes, entriesRes, settingsRes] = await Promise.all([
    db.from("catalog_exercises").select("*"),
    db.from("catalog_challenges").select("*"),
    db.from("training_rules").select("payload").eq("id", "default").maybeSingle(),
    db
      .from("content_items")
      .select("id, kind, title, body, media_url, goals, levels, published, sort_order")
      .eq("published", true)
      .order("sort_order", { ascending: true }),
    db.from("challenge_entries").select("challenge_id"),
    db.from("catalog_settings").select("taco_license_verified").eq("id", "default").maybeSingle(),
  ]);

  const participantCounts: Record<string, number> = {};
  for (const row of (entriesRes.data ?? []) as Array<{ challenge_id: string }>) {
    const id = String(row.challenge_id);
    participantCounts[id] = (participantCounts[id] ?? 0) + 1;
  }

  const tacoLicenseVerified = settingsRes.data?.taco_license_verified === true;
  let tacoFoods: FoodItem[] = [];
  let tacoServings: FoodServing[] = [];

  if (tacoLicenseVerified) {
    const [foodsRes, servingsRes, nutrientsRes] = await Promise.all([
      db.from("food_items").select("*").eq("source", "taco"),
      db.from("food_servings").select("*"),
      db.from("food_nutrients").select("food_id, nutrient_key, value, unit, source, kind, confidence"),
    ]);
    const nutrientsByFood = new Map<
      string,
      Array<{ nutrient_key?: string; value?: number; unit?: string; source?: string; kind?: string; confidence?: number }>
    >();
    for (const n of (nutrientsRes.data ?? []) as Array<Record<string, unknown>>) {
      const fid = String(n["food_id"] ?? "");
      if (!fid) continue;
      const list = nutrientsByFood.get(fid) ?? [];
      list.push(n as { nutrient_key?: string; value?: number; unit?: string; source?: string; kind?: string; confidence?: number });
      nutrientsByFood.set(fid, list);
    }
    const tacoIds = new Set<string>();
    for (const row of (foodsRes.data ?? []) as Record<string, unknown>[]) {
      const extras = extrasFromNutrientRows(nutrientsByFood.get(String(row["id"] ?? "")) ?? [], "taco" as FoodSource);
      const food = foodItemFromCatalogRow(row, extras);
      if (!food || food.source !== "taco") continue;
      tacoFoods.push(food);
      tacoIds.add(food.id);
    }
    tacoServings = ((servingsRes.data ?? []) as Record<string, unknown>[])
      .map(servingFromCatalogRow)
      .filter((s): s is FoodServing => Boolean(s && tacoIds.has(s.foodId)));
  }

  return {
    exercises: ((exRes.data ?? []) as Record<string, unknown>[]).map(rowToExerciseOverlay),
    challenges: ((chRes.data ?? []) as Record<string, unknown>[]).map(rowToChallengeOverlay),
    participantCounts,
    trainingRules:
      rulesRes.data?.payload && typeof rulesRes.data.payload === "object" && !Array.isArray(rulesRes.data.payload)
        ? (rulesRes.data.payload as Record<string, unknown>)
        : null,
    content: ((contentRes.data ?? []) as Record<string, unknown>[]).map(rowToContent),
    tacoLicenseVerified,
    tacoFoods,
    tacoServings,
  };
}

export async function listMergedExercisesAdmin(): Promise<ResolvedLibraryExercise[]> {
  const db = await adminDbLoose();
  if (!db) return mergeExercises(EXERCISE_LIBRARY, []);
  const { data } = await db.from("catalog_exercises").select("*");
  return mergeExercises(
    EXERCISE_LIBRARY,
    ((data ?? []) as Record<string, unknown>[]).map(rowToExerciseOverlay),
  );
}

export type ExerciseSaveInput = {
  id: string;
  name: string;
  group: MuscleGroup;
  equipment: Exercise["equipment"];
  swapGroup: string;
  joints: Joint[];
  unit: Exercise["unit"];
  baseLoad: number;
  priority: number;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  movementPattern?: string;
  difficulty?: string;
  plannerEligible: boolean;
  active: boolean;
  instructions: string[];
  videoUrl?: string | null;
  mediaUrl?: string | null;
  cues?: string | null;
  alternativeIds: string[];
};

export async function upsertCatalogExercise(
  input: ExerciseSaveInput,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const id = input.id.trim();
  if (!id || !input.name.trim()) return { ok: false, reason: "invalid" };

  const { error } = await db.from("catalog_exercises").upsert({
    id,
    name: input.name.trim(),
    muscle_group: input.group,
    equipment: input.equipment,
    swap_group: input.swapGroup,
    joints: input.joints,
    unit: input.unit,
    base_load: input.baseLoad,
    priority: input.priority,
    primary_muscles: input.primaryMuscles,
    secondary_muscles: input.secondaryMuscles,
    movement_pattern: input.movementPattern ?? null,
    difficulty: input.difficulty ?? null,
    planner_eligible: input.plannerEligible,
    active: input.active,
    instructions: input.instructions,
    video_url: input.videoUrl?.trim() || null,
    media_url: input.mediaUrl?.trim() || null,
    cues: input.cues?.trim() || null,
    alternative_ids: input.alternativeIds,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  });
  if (error) {
    console.error("catalog_exercises upsert failed", error);
    return { ok: false, reason: "upsert_failed" };
  }
  await writeAudit("catalog_exercise_save", { id, active: input.active }, actor);
  return { ok: true };
}

export type AdminChallengeRow = ChallengeOverlay & { participants: number };

export async function listMergedChallengesAdmin(): Promise<AdminChallengeRow[]> {
  const db = await adminDbLoose();
  const overlays = db
    ? ((await db.from("catalog_challenges").select("*")).data ?? []) as Record<string, unknown>[]
    : [];
  const counts: Record<string, number> = {};
  if (db) {
    const { data } = await db.from("challenge_entries").select("challenge_id");
    for (const row of (data ?? []) as Array<{ challenge_id: string }>) {
      const id = String(row.challenge_id);
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return mergeChallenges(CHALLENGES_SEED, overlays.map(rowToChallengeOverlay), counts).map((c) => ({
    ...c,
    durationDays: c.durationDays,
    participants: c.participants,
  }));
}

export type ChallengeSaveInput = {
  id: string;
  title: string;
  description: string;
  category: string;
  metric: string;
  target: number;
  unit: string;
  durationDays: number;
  rankingMode: string;
  reward?: string | null;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  requiresPerformance: boolean;
  targetPct?: number | null;
  personalTargetMin?: number | null;
  personalTargetMax?: number | null;
  personalTargetFactor?: number | null;
  personalTargetOffset?: number | null;
};

export async function upsertCatalogChallenge(
  input: ChallengeSaveInput,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const id = input.id.trim();
  if (!id || !input.title.trim()) return { ok: false, reason: "invalid" };

  const { error } = await db.from("catalog_challenges").upsert({
    id,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    metric: input.metric,
    target: input.target,
    unit: input.unit,
    duration_days: input.durationDays,
    ranking_mode: input.rankingMode,
    reward: input.reward?.trim() || null,
    active: input.active,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    requires_performance: input.requiresPerformance,
    target_pct: input.targetPct ?? null,
    personal_target_min: input.personalTargetMin ?? null,
    personal_target_max: input.personalTargetMax ?? null,
    personal_target_factor: input.personalTargetFactor ?? null,
    personal_target_offset: input.personalTargetOffset ?? null,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  });
  if (error) {
    console.error("catalog_challenges upsert failed", error);
    return { ok: false, reason: "upsert_failed" };
  }
  await writeAudit("catalog_challenge_save", { id, active: input.active }, actor);
  return { ok: true };
}

export async function loadTrainingRulesAdmin(): Promise<TrainingRules> {
  const db = await adminDbLoose();
  if (!db) return mergeTrainingRules({});
  const { data } = await db.from("training_rules").select("payload").eq("id", "default").maybeSingle();
  return mergeTrainingRules(data?.payload ?? {});
}

export async function saveTrainingRulesAdmin(
  payload: TrainingRules,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const merged = mergeTrainingRules(payload);
  const { error } = await db.from("training_rules").upsert({
    id: "default",
    payload: merged,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  });
  if (error) {
    console.error("training_rules upsert failed", error);
    return { ok: false, reason: "upsert_failed" };
  }
  await writeAudit("training_rules_save", { keys: Object.keys(merged) }, actor);
  return { ok: true };
}

export async function listContentItemsAdmin(): Promise<PublicContentItem[]> {
  const db = await adminDbLoose();
  if (!db) return [];
  const { data } = await db
    .from("content_items")
    .select("id, kind, title, body, media_url, goals, levels, published, sort_order")
    .order("updated_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(rowToContent);
}

export type ContentSaveInput = {
  id?: string;
  kind: ContentKind;
  title: string;
  body: string;
  mediaUrl?: string | null;
  goals: string[];
  levels: string[];
  published: boolean;
  sortOrder: number;
};

export async function upsertContentItem(
  input: ContentSaveInput,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  if (!input.title.trim()) return { ok: false, reason: "invalid" };
  const row: Record<string, unknown> = {
    kind: input.kind,
    title: input.title.trim(),
    body: input.body,
    media_url: input.mediaUrl?.trim() || null,
    goals: input.goals,
    levels: input.levels,
    published: input.published,
    sort_order: input.sortOrder,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row["id"] = input.id;
  const { data, error } = await db.from("content_items").upsert(row).select("id").maybeSingle();
  if (error) {
    console.error("content_items upsert failed", error);
    return { ok: false, reason: "upsert_failed" };
  }
  const id = String(data?.id ?? input.id ?? "");
  await writeAudit("content_item_save", { id, published: input.published }, actor);
  return { ok: true, id };
}

export async function deleteContentItem(
  id: string,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const { error } = await db.from("content_items").delete().eq("id", id);
  if (error) {
    console.error("content_items delete failed", error);
    return { ok: false, reason: "delete_failed" };
  }
  await writeAudit("content_item_delete", { id }, actor);
  return { ok: true };
}
