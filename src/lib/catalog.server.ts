/**
 * Catalog / CMS / training-rules persistence (service_role).
 */
import { adminDbLoose } from "@/lib/db-admin";
import { ADMIN_ACTOR, writeAudit } from "@/lib/admin.server";
import type {
  ExerciseOverlay,
  ChallengeOverlay,
  ResolvedLibraryExercise,
} from "@/lib/training/resolve-catalog";
import { mergeChallenges, resolveExerciseCatalog } from "@/lib/training/resolve-catalog";
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
import { isContentKind } from "@/lib/content-match";
import type {
  ContentCollection,
  ContentProgram,
  Expert,
  ProgramSession,
} from "@/lib/content/types";
import type { MuscleGroup, Joint, Exercise } from "@/data/exercises";
import type {
  CanonicalMovementPattern,
  Difficulty,
  MediaStatus,
} from "@/lib/training/canonical-exercise";
import type { ChallengeCategory, ChallengeMetric } from "@/data/challenges";
import type { GymGear } from "@/lib/types";

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
    videoUrl: (row["video_url"] as string | null) ?? null,
    mediaUrl: (row["media_url"] as string | null) ?? null,
    cues: (row["cues"] as string | null) ?? null,
    alternativeIds: asStringArray(row["alternative_ids"]),
  };
  const instructions = asStringArray(row["instructions"]);
  if (instructions.length) overlay.instructions = instructions;
  if (row["movement_pattern"])
    overlay.movementPattern = row["movement_pattern"] as CanonicalMovementPattern;
  if (row["difficulty"]) overlay.difficulty = row["difficulty"] as Difficulty;
  const canonicalName = String(row["canonical_name"] ?? "").trim();
  if (canonicalName) overlay.canonicalName = canonicalName;
  const displayNameEn = String(row["display_name_en"] ?? "").trim();
  if (displayNameEn) overlay.displayNameEn = displayNameEn;
  if (row["version"] != null && Number.isFinite(Number(row["version"])))
    overlay.version = Number(row["version"]);
  const aliases = asStringArray(row["aliases"]);
  if (aliases.length) overlay.aliases = aliases;
  const searchTerms = asStringArray(row["search_terms"]);
  if (searchTerms.length) overlay.searchTerms = searchTerms;
  const equipmentInventory = asStringArray(row["equipment_inventory"]) as GymGear[];
  if (equipmentInventory.length) overlay.equipmentInventory = equipmentInventory;
  const exerciseFamily = String(row["exercise_family"] ?? "").trim();
  if (exerciseFamily) overlay.exerciseFamily = exerciseFamily;
  const movementFamily = String(row["movement_family"] ?? "").trim();
  if (movementFamily) overlay.movementFamily = movementFamily;
  const progressionFamily = String(row["progression_family"] ?? "").trim();
  if (progressionFamily) overlay.progressionFamily = progressionFamily;
  const regressionFamily = String(row["regression_family"] ?? "").trim();
  if (regressionFamily) overlay.regressionFamily = regressionFamily;
  const contraindicationTags = asStringArray(row["contraindication_tags"]);
  if (contraindicationTags.length) overlay.contraindicationTags = contraindicationTags;
  const mediaId = String(row["media_id"] ?? "").trim();
  if (mediaId) overlay.mediaId = mediaId;
  if (row["media_status"]) overlay.mediaStatus = row["media_status"] as MediaStatus;
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
  if (row["personal_target_min"] != null)
    overlay.personalTargetMin = Number(row["personal_target_min"]);
  if (row["personal_target_max"] != null)
    overlay.personalTargetMax = Number(row["personal_target_max"]);
  if (row["personal_target_factor"] != null)
    overlay.personalTargetFactor = Number(row["personal_target_factor"]);
  if (row["personal_target_offset"] != null)
    overlay.personalTargetOffset = Number(row["personal_target_offset"]);
  return overlay;
}

function rowToContent(row: Record<string, unknown>): PublicContentItem {
  const media = row["media_url"] != null ? String(row["media_url"]) : "";
  const item: PublicContentItem = {
    id: String(row["id"] ?? ""),
    kind: isContentKind(row["kind"]) ? row["kind"] : "tip",
    title: String(row["title"] ?? ""),
    body: String(row["body"] ?? ""),
    goals: asStringArray(row["goals"]),
    levels: asStringArray(row["levels"]),
    published: Boolean(row["published"]),
    sortOrder: Number(row["sort_order"] ?? 0),
  };
  if (media) item.mediaUrl = media;
  const expertId = String(row["expert_id"] ?? "").trim();
  if (expertId) item.expertId = expertId;
  const collectionId = String(row["collection_id"] ?? "").trim();
  if (collectionId) item.collectionId = collectionId;
  const mediaId = String(row["media_id"] ?? "").trim();
  if (mediaId) item.mediaId = mediaId;
  const publishAt = String(row["publish_at"] ?? "").trim();
  if (publishAt) item.publishAt = publishAt;
  const unpublishAt = String(row["unpublish_at"] ?? "").trim();
  if (unpublishAt) item.unpublishAt = unpublishAt;
  if (row["visible"] === false) item.visible = false;
  else item.visible = true;
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
    experts: [],
    programs: [],
    collections: [],
    programSessions: [],
  };
  const db = await adminDbLoose();
  if (!db) return empty;

  const [
    exRes,
    chRes,
    rulesRes,
    contentRes,
    entriesRes,
    settingsRes,
    expertsRes,
    programsRes,
    collectionsRes,
    sessionsRes,
  ] = await Promise.all([
    db.from("catalog_exercises").select("*"),
    db.from("catalog_challenges").select("*"),
    db.from("training_rules").select("payload").eq("id", "default").maybeSingle(),
    db
      .from("content_items")
      .select(
        "id, kind, title, body, media_url, goals, levels, published, sort_order, expert_id, collection_id, media_id, publish_at, unpublish_at, visible",
      )
      .eq("published", true)
      .order("sort_order", { ascending: true }),
    db.from("challenge_entries").select("challenge_id"),
    db.from("catalog_settings").select("taco_license_verified").eq("id", "default").maybeSingle(),
    db.from("experts").select("*").eq("active", true),
    db.from("programs").select("*").eq("published", true),
    db.from("content_collections").select("*").eq("published", true),
    db.from("program_sessions").select("*"),
  ]);

  const participantCounts: Record<string, number> = {};
  for (const row of (entriesRes.data ?? []) as Array<{ challenge_id: string }>) {
    const id = String(row.challenge_id);
    participantCounts[id] = (participantCounts[id] ?? 0) + 1;
  }

  const tacoLicenseVerified = settingsRes.data?.taco_license_verified === true;
  const tacoFoods: FoodItem[] = [];
  let tacoServings: FoodServing[] = [];

  if (tacoLicenseVerified) {
    const [foodsRes, servingsRes, nutrientsRes] = await Promise.all([
      db.from("food_items").select("*").eq("source", "taco"),
      db.from("food_servings").select("*"),
      db
        .from("food_nutrients")
        .select("food_id, nutrient_key, value, unit, source, kind, confidence"),
    ]);
    const nutrientsByFood = new Map<
      string,
      Array<{
        nutrient_key?: string;
        value?: number;
        unit?: string;
        source?: string;
        kind?: string;
        confidence?: number;
      }>
    >();
    for (const n of (nutrientsRes.data ?? []) as Array<Record<string, unknown>>) {
      const fid = String(n["food_id"] ?? "");
      if (!fid) continue;
      const list = nutrientsByFood.get(fid) ?? [];
      list.push(
        n as {
          nutrient_key?: string;
          value?: number;
          unit?: string;
          source?: string;
          kind?: string;
          confidence?: number;
        },
      );
      nutrientsByFood.set(fid, list);
    }
    const tacoIds = new Set<string>();
    for (const row of (foodsRes.data ?? []) as Record<string, unknown>[]) {
      const extras = extrasFromNutrientRows(
        nutrientsByFood.get(String(row["id"] ?? "")) ?? [],
        "taco" as FoodSource,
      );
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
      rulesRes.data?.payload &&
      typeof rulesRes.data.payload === "object" &&
      !Array.isArray(rulesRes.data.payload)
        ? (rulesRes.data.payload as Record<string, unknown>)
        : null,
    content: ((contentRes.data ?? []) as Record<string, unknown>[])
      .map(rowToContent)
      .filter((item) => item.visible !== false),
    tacoLicenseVerified,
    tacoFoods,
    tacoServings,
    experts: ((expertsRes.data ?? []) as Record<string, unknown>[]).map(rowToExpert),
    programs: ((programsRes.data ?? []) as Record<string, unknown>[]).map(rowToProgram),
    collections: ((collectionsRes.data ?? []) as Record<string, unknown>[]).map(rowToCollection),
    programSessions: ((sessionsRes.data ?? []) as Record<string, unknown>[]).map(
      rowToProgramSession,
    ),
  };
}

export async function listMergedExercisesAdmin(): Promise<ResolvedLibraryExercise[]> {
  const db = await adminDbLoose();
  if (!db) return resolveExerciseCatalog(EXERCISE_LIBRARY, []);
  const { data } = await db.from("catalog_exercises").select("*");
  return resolveExerciseCatalog(
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
  cues?: string | string[] | null;
  alternativeIds: string[];
  canonicalName?: string;
  displayNameEn?: string | null;
  version?: number;
  aliases?: string[];
  searchTerms?: string[];
  equipmentInventory?: string[];
  exerciseFamily?: string | null;
  movementFamily?: string | null;
  progressionFamily?: string | null;
  regressionFamily?: string | null;
  contraindicationTags?: string[];
  mediaId?: string | null;
  mediaStatus?: string | null;
};

export async function upsertCatalogExercise(
  input: ExerciseSaveInput,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const id = input.id.trim();
  if (!id || !input.name.trim()) return { ok: false, reason: "invalid" };

  const cuesValue = Array.isArray(input.cues)
    ? input.cues
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n")
    : input.cues?.trim() || null;

  const row: Record<string, unknown> = {
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
    cues: cuesValue,
    alternative_ids: input.alternativeIds,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  };
  if (input.canonicalName != null) row["canonical_name"] = input.canonicalName.trim() || id;
  if (input.displayNameEn !== undefined)
    row["display_name_en"] = input.displayNameEn?.trim() || null;
  if (typeof input.version === "number") row["version"] = input.version;
  if (input.aliases != null) row["aliases"] = input.aliases;
  if (input.searchTerms != null) row["search_terms"] = input.searchTerms;
  if (input.equipmentInventory != null) row["equipment_inventory"] = input.equipmentInventory;
  if (input.exerciseFamily !== undefined)
    row["exercise_family"] = input.exerciseFamily?.trim() || null;
  if (input.movementFamily !== undefined)
    row["movement_family"] = input.movementFamily?.trim() || null;
  if (input.progressionFamily !== undefined)
    row["progression_family"] = input.progressionFamily?.trim() || null;
  if (input.regressionFamily !== undefined)
    row["regression_family"] = input.regressionFamily?.trim() || null;
  if (input.contraindicationTags != null) row["contraindication_tags"] = input.contraindicationTags;
  if (input.mediaId !== undefined) row["media_id"] = input.mediaId?.trim() || id;
  if (input.mediaStatus !== undefined) row["media_status"] = input.mediaStatus?.trim() || null;

  const { error } = await db.from("catalog_exercises").upsert(row);
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
    ? (((await db.from("catalog_challenges").select("*")).data ?? []) as Record<string, unknown>[])
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
  const { data } = await db
    .from("training_rules")
    .select("payload")
    .eq("id", "default")
    .maybeSingle();
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
    .select(
      "id, kind, title, body, media_url, goals, levels, published, sort_order, expert_id, collection_id, media_id, publish_at, unpublish_at, visible",
    )
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
  expertId?: string | null;
  collectionId?: string | null;
  mediaId?: string | null;
  publishAt?: string | null;
  unpublishAt?: string | null;
  visible?: boolean;
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
    expert_id: input.expertId?.trim() || null,
    collection_id: input.collectionId?.trim() || null,
    media_id: input.mediaId?.trim() || null,
    publish_at: input.publishAt?.trim() || null,
    unpublish_at: input.unpublishAt?.trim() || null,
    visible: input.visible !== false,
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

function rowToExpert(row: Record<string, unknown>): Expert {
  const rec: Expert = {
    id: String(row["id"] ?? ""),
    name: String(row["name"] ?? ""),
    bio: String(row["bio"] ?? ""),
    specialty: String(row["specialty"] ?? ""),
    verified: Boolean(row["verified"]),
    active: row["active"] !== false,
  };
  const photo = String(row["photo_media_id"] ?? "").trim();
  if (photo) rec.photoMediaId = photo;
  if (row["social"] && typeof row["social"] === "object")
    rec.social = row["social"] as Record<string, string>;
  return rec;
}

function rowToCollection(row: Record<string, unknown>): ContentCollection {
  const rec: ContentCollection = {
    id: String(row["id"] ?? ""),
    title: String(row["title"] ?? ""),
    kind: String(row["kind"] ?? "education"),
    published: Boolean(row["published"]),
    sortOrder: Number(row["sort_order"] ?? 0),
  };
  const expertId = String(row["expert_id"] ?? "").trim();
  if (expertId) rec.expertId = expertId;
  const cover = String(row["cover_media_id"] ?? "").trim();
  if (cover) rec.coverMediaId = cover;
  return rec;
}

function rowToProgram(row: Record<string, unknown>): ContentProgram {
  const rec: ContentProgram = {
    id: String(row["id"] ?? ""),
    title: String(row["title"] ?? ""),
    description: String(row["description"] ?? ""),
    durationWeeks: Number(row["duration_weeks"] ?? 4),
    sessionsPerWeek: Number(row["sessions_per_week"] ?? 3),
    expertIds: asStringArray(row["expert_ids"]),
    published: Boolean(row["published"]),
  };
  const goal = String(row["goal"] ?? "").trim();
  if (goal) rec.goal = goal;
  const level = String(row["level"] ?? "").trim();
  if (level) rec.level = level;
  const cover = String(row["cover_media_id"] ?? "").trim();
  if (cover) rec.coverMediaId = cover;
  const publishAt = String(row["publish_at"] ?? "").trim();
  if (publishAt) rec.publishAt = publishAt;
  return rec;
}

function rowToProgramSession(row: Record<string, unknown>): ProgramSession {
  const rec: ProgramSession = {
    id: String(row["id"] ?? ""),
    programId: String(row["program_id"] ?? ""),
    week: Number(row["week"] ?? 1),
    day: Number(row["day"] ?? 1),
  };
  const contentItemId = String(row["content_item_id"] ?? "").trim();
  if (contentItemId) rec.contentItemId = contentItemId;
  if (row["training_json"] && typeof row["training_json"] === "object") {
    rec.training = row["training_json"] as Record<string, unknown>;
  }
  if (row["nutrition_json"] && typeof row["nutrition_json"] === "object") {
    rec.nutrition = row["nutrition_json"] as Record<string, unknown>;
  }
  if (row["recovery_json"] && typeof row["recovery_json"] === "object") {
    rec.recovery = row["recovery_json"] as Record<string, unknown>;
  }
  return rec;
}

export async function listExpertsAdmin(): Promise<Expert[]> {
  const db = await adminDbLoose();
  if (!db) return [];
  const { data } = await db.from("experts").select("*").order("updated_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(rowToExpert);
}

export async function upsertExpert(
  input: Expert,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const id = input.id.trim() || `expert-${Date.now()}`;
  const { error } = await db.from("experts").upsert({
    id,
    name: input.name.trim(),
    bio: input.bio,
    specialty: input.specialty,
    photo_media_id: input.photoMediaId ?? null,
    social: input.social ?? {},
    verified: input.verified,
    active: input.active,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, reason: "upsert_failed" };
  await writeAudit("expert_save", { id }, actor);
  return { ok: true, id };
}

export async function listProgramsAdmin(): Promise<ContentProgram[]> {
  const db = await adminDbLoose();
  if (!db) return [];
  const { data } = await db.from("programs").select("*").order("updated_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(rowToProgram);
}

export async function upsertProgram(
  input: ContentProgram,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const id = input.id.trim() || `program-${Date.now()}`;
  const { error } = await db.from("programs").upsert({
    id,
    title: input.title.trim(),
    description: input.description,
    goal: input.goal ?? null,
    level: input.level ?? null,
    duration_weeks: input.durationWeeks,
    sessions_per_week: input.sessionsPerWeek,
    expert_ids: input.expertIds,
    published: input.published,
    cover_media_id: input.coverMediaId ?? null,
    publish_at: input.publishAt ?? null,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, reason: "upsert_failed" };
  await writeAudit("program_save", { id, published: input.published }, actor);
  return { ok: true, id };
}

export async function listCollectionsAdmin(): Promise<ContentCollection[]> {
  const db = await adminDbLoose();
  if (!db) return [];
  const { data } = await db
    .from("content_collections")
    .select("*")
    .order("sort_order", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map(rowToCollection);
}

export async function upsertCollection(
  input: ContentCollection,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const id = input.id.trim() || `col-${Date.now()}`;
  const { error } = await db.from("content_collections").upsert({
    id,
    title: input.title.trim(),
    kind: input.kind,
    expert_id: input.expertId ?? null,
    cover_media_id: input.coverMediaId ?? null,
    published: input.published,
    sort_order: input.sortOrder,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, reason: "upsert_failed" };
  await writeAudit("collection_save", { id, published: input.published }, actor);
  return { ok: true, id };
}
