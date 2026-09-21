export const SOLDIERS_MEDIA_KINDS = [
  "exercise",
  "meal",
  "product",
  "hub",
  "challenge",
  "brand",
  "howto",
  "expert",
  "program",
] as const;

export type SoldiersMediaKind = (typeof SOLDIERS_MEDIA_KINDS)[number];

/** Canonical package status. `pending` is accepted on read and mapped to `draft`. */
export const SOLDIERS_MEDIA_STATUSES = [
  "draft",
  "generated",
  "qa",
  "approved",
  "published",
  "rejected",
  "archived",
] as const;

export type SoldiersMediaStatus = (typeof SOLDIERS_MEDIA_STATUSES)[number];

export const MEDIA_VERSION = "v1";
export const MEDIA_STYLE = "soldiers-v1";
export const MEDIA_VARIANT_DEFAULT = "default";
export const MEDIA_REGION_GLOBAL = "global";

export interface AnimationSpec {
  start: string;
  end: string;
  tempo: "controlled" | "explosive" | "hold";
  durationSec: number;
  loop: boolean;
  camera: "three-quarter" | "side" | "front";
}

export interface MediaChecksums {
  poster?: string;
  thumbnail?: string;
  webm?: string;
  mp4?: string;
  gif?: string;
}

/**
 * Soldiers-owned media package.
 * `kind` is canonical (DB). `entityType` is an alias of `kind`.
 */
export interface SoldiersMediaAsset {
  kind: SoldiersMediaKind;
  entityId: string;
  version: string;
  style: string;
  source: "soldiers";
  ownership: "owned";
  license: "soldiers-owned";
  needsMotion: boolean;
  status: SoldiersMediaStatus;
  variant: string;
  region: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  webmUrl?: string;
  mp4Url?: string;
  gifUrl?: string;
  durationSec?: number;
  animationSpec?: AnimationSpec;
  prompt?: string;
  qaNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  checksums?: MediaChecksums;
}

export type MediaPackage = SoldiersMediaAsset;

export function entityTypeOf(pack: Pick<SoldiersMediaAsset, "kind">): SoldiersMediaKind {
  return pack.kind;
}

export function animationUrl(pack: SoldiersMediaAsset): string | undefined {
  const url = pack.webmUrl ?? pack.mp4Url ?? pack.gifUrl;
  return url?.trim() ? url : undefined;
}

export function isSoldiersMediaKind(value: string): value is SoldiersMediaKind {
  return (SOLDIERS_MEDIA_KINDS as readonly string[]).includes(value);
}

export function isSoldiersMediaStatus(value: string): value is SoldiersMediaStatus {
  return (SOLDIERS_MEDIA_STATUSES as readonly string[]).includes(value);
}

export function normalizeMediaStatus(raw: string | null | undefined): SoldiersMediaStatus {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (value === "pending") return "draft";
  if (isSoldiersMediaStatus(value)) return value;
  return "draft";
}

export function publicMediaPath(kind: SoldiersMediaKind, entityId: string, file: string) {
  return `/soldiers-media/${MEDIA_VERSION}/${kind}/${entityId}/${file}`;
}
