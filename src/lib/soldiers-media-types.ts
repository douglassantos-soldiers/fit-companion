export const SOLDIERS_MEDIA_KINDS = [
  "exercise",
  "meal",
  "product",
  "hub",
  "challenge",
  "brand",
  "howto",
] as const;

export type SoldiersMediaKind = (typeof SOLDIERS_MEDIA_KINDS)[number];

export type SoldiersMediaStatus = "pending" | "generated" | "qa" | "published" | "rejected";

export interface AnimationSpec {
  start: string;
  end: string;
  tempo: "controlled" | "explosive" | "hold";
  durationSec: number;
  loop: boolean;
  camera: "three-quarter" | "side" | "front";
}

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
  posterUrl?: string;
  thumbnailUrl?: string;
  webmUrl?: string;
  mp4Url?: string;
  gifUrl?: string;
  durationSec?: number;
  animationSpec?: AnimationSpec;
  prompt?: string;
}

export const MEDIA_VERSION = "v1";
export const MEDIA_STYLE = "soldiers-v1";

export function publicMediaPath(kind: SoldiersMediaKind, entityId: string, file: string) {
  return `/soldiers-media/${MEDIA_VERSION}/${kind}/${entityId}/${file}`;
}
