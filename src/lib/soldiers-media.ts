/**
 * Soldiers Media Library resolver.
 * Order: CMS override → published Soldiers package → legacy Unsplash → caller fallback.
 */
import { exerciseMediaUrl, mealImageUrl } from "@/lib/cms";
import { libraryById } from "@/data/exercise-library";
import { manifestAsset } from "@/data/soldiers-media-manifest";
import type { SoldiersMediaAsset, SoldiersMediaKind } from "@/lib/soldiers-media-types";

export interface ResolvedMedia {
  kind: SoldiersMediaKind;
  entityId: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  webmUrl?: string;
  mp4Url?: string;
  gifUrl?: string;
  source: "cms" | "soldiers" | "legacy" | "none";
  needsMotion: boolean;
}

const remotePublished = new Map<string, SoldiersMediaAsset>();

function k(kind: SoldiersMediaKind, entityId: string) {
  return `${kind}:${entityId}`;
}

/** Merge rows fetched from soldiers_media (published). */
export function hydrateSoldiersMedia(rows: SoldiersMediaAsset[]) {
  remotePublished.clear();
  for (const row of rows) {
    if (row.status !== "published") continue;
    remotePublished.set(k(row.kind, row.entityId), row);
  }
}

function packageOf(kind: SoldiersMediaKind, entityId: string): SoldiersMediaAsset | undefined {
  return remotePublished.get(k(kind, entityId)) ?? manifestAsset(kind, entityId);
}

function hasFile(url?: string) {
  return Boolean(url && url.trim());
}

export function resolveSoldiersMedia(
  kind: SoldiersMediaKind,
  entityId: string,
  legacyUrl?: string,
): ResolvedMedia {
  const pack = packageOf(kind, entityId);
  const cms =
    kind === "exercise"
      ? exerciseMediaUrl(entityId)
      : kind === "meal"
        ? mealImageUrl(entityId)
        : undefined;

  if (cms) {
    const looksVideo = /\.(webm|mp4)(\?|$)/i.test(cms);
    const looksGif = /\.gif(\?|$)/i.test(cms);
    return {
      kind,
      entityId,
      source: "cms",
      needsMotion: Boolean(pack?.needsMotion),
      ...(looksVideo && cms.toLowerCase().includes(".webm") ? { webmUrl: cms } : {}),
      ...(looksVideo && cms.toLowerCase().includes(".mp4") ? { mp4Url: cms } : {}),
      ...(looksGif ? { gifUrl: cms } : {}),
      ...(!looksVideo ? { posterUrl: cms, thumbnailUrl: cms } : { posterUrl: pack?.posterUrl }),
    };
  }

  if (pack && pack.status === "published") {
    const poster = pack.posterUrl;
    const webm = pack.webmUrl;
    const mp4 = pack.mp4Url;
    // Local pilot: posters exist; video files may not until transcode.
    return {
      kind,
      entityId,
      source: "soldiers",
      needsMotion: pack.needsMotion,
      ...(hasFile(poster) ? { posterUrl: poster, thumbnailUrl: pack.thumbnailUrl ?? poster } : {}),
      ...(hasFile(webm) ? { webmUrl: webm } : {}),
      ...(hasFile(mp4) ? { mp4Url: mp4 } : {}),
      ...(hasFile(pack.gifUrl) ? { gifUrl: pack.gifUrl } : {}),
    };
  }

  if (legacyUrl) {
    return {
      kind,
      entityId,
      source: "legacy",
      needsMotion: Boolean(pack?.needsMotion),
      posterUrl: legacyUrl,
      thumbnailUrl: legacyUrl,
    };
  }

  return { kind, entityId, source: "none", needsMotion: Boolean(pack?.needsMotion) };
}

export function resolveExerciseMedia(exerciseId: string, legacyUrl?: string) {
  return resolveSoldiersMedia("exercise", exerciseId, legacyUrl);
}

export function resolveMealMedia(mealId: string, legacyUrl?: string) {
  return resolveSoldiersMedia("meal", mealId, legacyUrl);
}

export function resolveProductMedia(productId: string) {
  return resolveSoldiersMedia("product", productId);
}

export function resolveHubMedia(hubSlug: string) {
  return resolveSoldiersMedia("hub", hubSlug);
}

export function resolveChallengeMedia(category: string) {
  return resolveSoldiersMedia("challenge", category);
}

export function resolveBrandMedia(id: string) {
  return resolveSoldiersMedia("brand", id);
}

export function resolveHowtoMedia(id: string) {
  return resolveSoldiersMedia("howto", id);
}

export function exerciseInstructions(exerciseId: string): string[] {
  return libraryById(exerciseId)?.instructions ?? [];
}
