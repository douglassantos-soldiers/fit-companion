import { MEAL_PRESETS } from "@/data/meal-presets";
import { PRODUCTS } from "@/data/products";
import { HUBS } from "@/data/hubs";
import { EXERCISE_LIBRARY } from "@/data/exercise-library";
import { PUBLISHED_EXERCISE_IDS } from "@/data/soldiers-media-published-ids";
import {
  MEDIA_STYLE,
  MEDIA_VERSION,
  publicMediaPath,
  type SoldiersMediaAsset,
  type SoldiersMediaKind,
} from "@/lib/soldiers-media-types";

/** Pilot set kept for docs / tooling; published set is PUBLISHED_EXERCISE_IDS. */
export const PILOT_EXERCISE_IDS = [
  "supino-reto",
  "flexao",
  "remada-curvada",
  "barra-fixa",
  "agachamento",
  "terra-romeno",
  "desenvolvimento",
  "elevacao-lateral",
  "rosca-direta",
  "prancha",
] as const;

export { PUBLISHED_EXERCISE_IDS };

export const HOWTO_IDS = ["log-meal", "mix-whey", "complete-set"] as const;
export const BRAND_IDS = ["welcome-hero"] as const;
export const EXPERT_MEDIA_IDS = ["expert-soldiers-coach", "expert-soldiers-recovery"] as const;
export const PROGRAM_MEDIA_IDS = ["program-base-4w"] as const;
export const CHALLENGE_CATEGORY_IDS = [
  "consistency",
  "strength",
  "steps",
  "running",
  "muscle_gain",
  "conditioning",
] as const;

const OWNED = {
  version: MEDIA_VERSION,
  style: MEDIA_STYLE,
  source: "soldiers" as const,
  ownership: "owned" as const,
  license: "soldiers-owned" as const,
  variant: "default" as const,
  region: "global" as const,
};

function posterAsset(
  kind: SoldiersMediaKind,
  entityId: string,
  needsMotion: boolean,
  published: boolean,
  extra?: Partial<SoldiersMediaAsset>,
): SoldiersMediaAsset {
  const posterUrl = publicMediaPath(kind, entityId, "poster.webp");
  const thumbnailUrl = publicMediaPath(kind, entityId, "thumb.webp");
  return {
    kind,
    entityId,
    ...OWNED,
    needsMotion,
    status: published ? "published" : "draft",
    ...(published ? { posterUrl, thumbnailUrl } : {}),
    ...(published && needsMotion
      ? {
          webmUrl: publicMediaPath(kind, entityId, "animation.webm"),
          mp4Url: publicMediaPath(kind, entityId, "animation.mp4"),
        }
      : {}),
    ...extra,
  };
}

function buildManifest(): SoldiersMediaAsset[] {
  const rows: SoldiersMediaAsset[] = [];

  for (const ex of EXERCISE_LIBRARY) {
    const published = (PUBLISHED_EXERCISE_IDS as readonly string[]).includes(ex.id);
    rows.push(
      posterAsset("exercise", ex.id, true, published, {
        durationSec: ex.animationSpec.durationSec,
        animationSpec: ex.animationSpec,
        prompt: `Soldiers athlete v1, ${ex.name}: start ${ex.animationSpec.start}; end ${ex.animationSpec.end}; 4s loop; dark studio; no text; original character only.`,
      }),
    );
  }

  for (const meal of MEAL_PRESETS) {
    rows.push(
      posterAsset("meal", meal.id, false, true, {
        prompt: `Soldiers food bible: ${meal.label}, dark plate, gold light, no people, no text.`,
      }),
    );
  }

  for (const product of PRODUCTS) {
    rows.push(
      posterAsset("product", product.id, false, true, {
        prompt: `Soldiers pack shot: ${product.name}, matte black tub, gold mark, #080808, no lifestyle.`,
      }),
    );
  }

  for (const hub of HUBS) {
    rows.push(
      posterAsset("hub", hub.slug, false, true, {
        prompt: `Soldiers hub cover 16:9 for ${hub.name}, dark gold athletic atmosphere, no text.`,
      }),
    );
  }

  for (const cat of CHALLENGE_CATEGORY_IDS) {
    rows.push(
      posterAsset("challenge", cat, false, true, {
        prompt: `Soldiers challenge emblem still, category ${cat}, dark gold, no text.`,
      }),
    );
  }

  for (const id of BRAND_IDS) {
    rows.push(
      posterAsset("brand", id, true, true, {
        durationSec: 4,
        prompt:
          "Soldiers welcome hero: athlete looping a clean squat-to-stand in dark gold studio, 4s, no text.",
      }),
    );
  }

  const howtoPrompts: Record<(typeof HOWTO_IDS)[number], string> = {
    "log-meal":
      "Hands logging a meal on a dark phone in Soldiers app, 3s loop, no readable UI text.",
    "mix-whey":
      "Athlete mixing whey in a black shaker, gold rim light, 3s loop, no brand besides Soldiers.",
    "complete-set":
      "Athlete racking a barbell after a set, nod of completion, 3s loop, dark studio.",
  };
  for (const id of HOWTO_IDS) {
    rows.push(
      posterAsset("howto", id, true, true, {
        durationSec: 3,
        prompt: howtoPrompts[id],
      }),
    );
  }

  for (const id of EXPERT_MEDIA_IDS) {
    rows.push(posterAsset("expert", id, false, false));
  }
  for (const id of PROGRAM_MEDIA_IDS) {
    rows.push(posterAsset("program", id, false, false));
  }

  return rows;
}

export const SOLDIERS_MEDIA_MANIFEST: SoldiersMediaAsset[] = buildManifest();

const key = (kind: SoldiersMediaKind, entityId: string) => `${kind}:${entityId}`;

const publishedIndex = new Map(
  SOLDIERS_MEDIA_MANIFEST.filter((a) => a.status === "published").map((a) => [
    key(a.kind, a.entityId),
    a,
  ]),
);

export function manifestAsset(
  kind: SoldiersMediaKind,
  entityId: string,
): SoldiersMediaAsset | undefined {
  return (
    publishedIndex.get(key(kind, entityId)) ??
    SOLDIERS_MEDIA_MANIFEST.find((a) => a.kind === kind && a.entityId === entityId)
  );
}

export type KindCoverage = {
  total: number;
  published: number;
  motion: number;
  motionPublished: number;
  motionWithoutVideo: number;
};

export function coverageReport(): Record<string, KindCoverage> {
  const byKind = new Map<string, KindCoverage>();
  for (const row of SOLDIERS_MEDIA_MANIFEST) {
    const cur = byKind.get(row.kind) ?? {
      total: 0,
      published: 0,
      motion: 0,
      motionPublished: 0,
      motionWithoutVideo: 0,
    };
    cur.total += 1;
    if (row.status === "published") cur.published += 1;
    if (row.needsMotion) cur.motion += 1;
    if (row.needsMotion && row.status === "published") {
      cur.motionPublished += 1;
      const hasVideo = Boolean(row.webmUrl?.trim() || row.mp4Url?.trim());
      if (!hasVideo) cur.motionWithoutVideo += 1;
    }
    byKind.set(row.kind, cur);
  }
  return Object.fromEntries(byKind);
}
