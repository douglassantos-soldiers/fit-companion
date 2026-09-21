/**
 * Soldiers Media Library resolver.
 * Order: published Soldiers package → authorized CMS (soldiers-owned) → legacy (migration env only).
 */
import { exerciseMediaUrl, mealImageUrl } from "@/lib/cms";
import { libraryById } from "@/data/exercise-library";
import { manifestAsset } from "@/data/soldiers-media-manifest";
import {
  isExternalMediaUrl,
  isProductionPackage,
  isSoldiersOwnedUrl,
  legacyMediaFallbackEnabled,
} from "@/lib/soldiers-media-governance";
import {
  MEDIA_REGION_GLOBAL,
  MEDIA_VARIANT_DEFAULT,
  type SoldiersMediaAsset,
  type SoldiersMediaKind,
} from "@/lib/soldiers-media-types";

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

export type ResolveMediaOpts = {
  allowLegacy?: boolean;
};

const remotePublished = new Map<string, SoldiersMediaAsset>();

function k(kind: SoldiersMediaKind, entityId: string) {
  return `${kind}:${entityId}`;
}

function isDefaultSlot(row: SoldiersMediaAsset) {
  return (
    (row.variant || MEDIA_VARIANT_DEFAULT) === MEDIA_VARIANT_DEFAULT &&
    (row.region || MEDIA_REGION_GLOBAL) === MEDIA_REGION_GLOBAL
  );
}

/** Merge rows fetched from soldiers_media (published). */
export function hydrateSoldiersMedia(rows: SoldiersMediaAsset[]) {
  remotePublished.clear();
  for (const row of rows) {
    if (!isProductionPackage(row) || !isDefaultSlot(row)) continue;
    remotePublished.set(k(row.kind, row.entityId), row);
  }
}

function packageOf(kind: SoldiersMediaKind, entityId: string): SoldiersMediaAsset | undefined {
  return remotePublished.get(k(kind, entityId)) ?? manifestAsset(kind, entityId);
}

function hasFile(url?: string) {
  return Boolean(url && url.trim());
}

function fromCmsUrl(
  kind: SoldiersMediaKind,
  entityId: string,
  cms: string,
  needsMotion: boolean,
): ResolvedMedia | undefined {
  if (!isSoldiersOwnedUrl(cms) || isExternalMediaUrl(cms)) return undefined;
  const looksVideo = /\.(webm|mp4)(\?|$)/i.test(cms);
  const looksGif = /\.gif(\?|$)/i.test(cms);
  return {
    kind,
    entityId,
    source: "cms",
    needsMotion,
    ...(looksVideo && cms.toLowerCase().includes(".webm") ? { webmUrl: cms } : {}),
    ...(looksVideo && cms.toLowerCase().includes(".mp4") ? { mp4Url: cms } : {}),
    ...(looksGif ? { gifUrl: cms } : {}),
    ...(!looksVideo ? { posterUrl: cms, thumbnailUrl: cms } : {}),
  };
}

export function resolveSoldiersMedia(
  kind: SoldiersMediaKind,
  entityId: string,
  legacyUrl?: string,
  opts?: ResolveMediaOpts,
): ResolvedMedia {
  const pack = packageOf(kind, entityId);
  const needsMotion = Boolean(pack?.needsMotion);

  if (pack && isProductionPackage(pack)) {
    const poster = pack.posterUrl;
    const webm = pack.webmUrl;
    const mp4 = pack.mp4Url;
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

  const cms =
    kind === "exercise"
      ? exerciseMediaUrl(entityId)
      : kind === "meal"
        ? mealImageUrl(entityId)
        : undefined;
  const cmsResolved = cms ? fromCmsUrl(kind, entityId, cms, needsMotion) : undefined;
  if (cmsResolved) return cmsResolved;

  const allowLegacy = opts?.allowLegacy ?? legacyMediaFallbackEnabled();
  if (allowLegacy && legacyUrl?.trim()) {
    return {
      kind,
      entityId,
      source: "legacy",
      needsMotion,
      posterUrl: legacyUrl,
      thumbnailUrl: legacyUrl,
    };
  }

  return { kind, entityId, source: "none", needsMotion };
}

export function resolveExerciseMedia(
  exerciseId: string,
  legacyUrl?: string,
  opts?: ResolveMediaOpts,
) {
  const mediaId = libraryById(exerciseId)?.mediaId ?? exerciseId;
  return resolveSoldiersMedia("exercise", mediaId, legacyUrl, opts);
}

export function resolveMealMedia(mealId: string, legacyUrl?: string, opts?: ResolveMediaOpts) {
  return resolveSoldiersMedia("meal", mealId, legacyUrl, opts);
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
