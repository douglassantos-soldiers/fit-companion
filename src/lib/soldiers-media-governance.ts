/**
 * Soldiers Media Governance — ownership firewall, package validation, status machine.
 */
import {
  MEDIA_REGION_GLOBAL,
  MEDIA_VARIANT_DEFAULT,
  isSoldiersMediaKind,
  isSoldiersMediaStatus,
  normalizeMediaStatus,
  type SoldiersMediaAsset,
  type SoldiersMediaStatus,
} from "@/lib/soldiers-media-types";

const EXTERNAL_HOST_RE =
  /unsplash|gymvisual|gym-visual|opengym|open-gym|youtube|ytimg|wikimedia|pexels|pixabay|giphy/i;

export type MediaValidationIssue = {
  code: string;
  message: string;
};

export type MediaCoverageInputs = {
  exercises: Array<{
    id: string;
    mediaId?: string;
    mediaUrl?: string;
    videoUrl?: string;
  }>;
  packages: SoldiersMediaAsset[];
  cmsUrls?: Array<{ url: string; authorized?: boolean }>;
};

export type MediaCoverageReport = {
  totalExercises: number;
  mediaComplete: number;
  posterMissing: number;
  thumbMissing: number;
  motionMissing: number;
  qaPending: number;
  published: number;
  rejected: number;
  legacy: number;
  externalUrls: number;
};

const STATUS_TRANSITIONS: Record<SoldiersMediaStatus, readonly SoldiersMediaStatus[]> = {
  draft: ["generated"],
  generated: ["qa"],
  qa: ["approved", "rejected"],
  approved: ["published", "rejected"],
  published: ["archived"],
  rejected: ["draft"],
  archived: [],
};

function envFlag(name: string): string {
  try {
    if (typeof import.meta !== "undefined") {
      const vite = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
      const fromVite = vite?.[name];
      if (fromVite) return String(fromVite);
    }
  } catch {
    /* ignore */
  }
  if (typeof process !== "undefined" && process.env) {
    return String(process.env[name] ?? "");
  }
  return "";
}

export function legacyMediaFallbackEnabled(): boolean {
  const raw = envFlag("VITE_MEDIA_LEGACY_FALLBACK") || envFlag("MEDIA_LEGACY_FALLBACK");
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function isSoldiersOwnedUrl(url: string | null | undefined): boolean {
  const value = String(url ?? "").trim();
  if (!value) return false;
  if (value.startsWith("/soldiers-media/")) return true;
  try {
    const parsed = new URL(value, "https://soldiers.local");
    if (parsed.pathname.includes("/soldiers-media/")) return true;
    if (parsed.pathname.includes("/storage/v1/object/public/soldiers-media/")) return true;
    if (parsed.pathname.includes("/object/public/soldiers-media/")) return true;
  } catch {
    return false;
  }
  return false;
}

export function isExternalMediaUrl(url: string | null | undefined): boolean {
  const value = String(url ?? "").trim();
  if (!value) return false;
  if (isSoldiersOwnedUrl(value)) return false;
  if (EXTERNAL_HOST_RE.test(value)) return true;
  return /^https?:\/\//i.test(value);
}

export function packageUrls(pack: SoldiersMediaAsset): string[] {
  return [pack.posterUrl, pack.thumbnailUrl, pack.webmUrl, pack.mp4Url, pack.gifUrl].filter(
    (url): url is string => Boolean(url && url.trim()),
  );
}

export function isProductionPackage(pack: SoldiersMediaAsset): boolean {
  if (pack.status !== "published") return false;
  if (
    pack.source !== "soldiers" ||
    pack.ownership !== "owned" ||
    pack.license !== "soldiers-owned"
  ) {
    return false;
  }
  if ((pack.variant || MEDIA_VARIANT_DEFAULT) !== MEDIA_VARIANT_DEFAULT) return false;
  if ((pack.region || MEDIA_REGION_GLOBAL) !== MEDIA_REGION_GLOBAL) return false;
  if (packageUrls(pack).some((url) => isExternalMediaUrl(url))) return false;
  return true;
}

export function validateMediaPackage(
  pack: SoldiersMediaAsset,
  opts?: { requireChecksums?: boolean; asPublished?: boolean },
): MediaValidationIssue[] {
  const issues: MediaValidationIssue[] = [];
  if (!isSoldiersMediaKind(pack.kind)) {
    issues.push({ code: "kind", message: "kind inválido" });
  }
  if (!pack.entityId?.trim()) {
    issues.push({ code: "entityId", message: "entityId obrigatório" });
  }
  if (!pack.version?.trim()) {
    issues.push({ code: "version", message: "version obrigatória" });
  }
  if (!isSoldiersMediaStatus(pack.status) && pack.status !== undefined) {
    issues.push({ code: "status", message: "status inválido" });
  }
  if (pack.ownership !== "owned") {
    issues.push({ code: "ownership", message: "ownership deve ser owned" });
  }
  if (pack.license !== "soldiers-owned") {
    issues.push({ code: "license", message: "license deve ser soldiers-owned" });
  }
  if (pack.source !== "soldiers") {
    issues.push({ code: "source", message: "source deve ser soldiers" });
  }

  for (const url of packageUrls(pack)) {
    if (isExternalMediaUrl(url)) {
      issues.push({
        code: "external_url",
        message: `URL externa não pode ser soldiers-owned: ${url}`,
      });
    }
  }

  const treatPublished = Boolean(opts?.asPublished) || pack.status === "published";
  if (treatPublished) {
    if (!pack.posterUrl?.trim()) {
      issues.push({ code: "poster_missing", message: "published exige poster" });
    }
    if (!pack.thumbnailUrl?.trim() && !pack.posterUrl?.trim()) {
      issues.push({ code: "thumb_missing", message: "published exige thumbnail" });
    }
    if (pack.needsMotion && !pack.webmUrl?.trim() && !pack.mp4Url?.trim()) {
      issues.push({
        code: "motion_missing",
        message: "published com needsMotion exige webm ou mp4",
      });
    }
    if (opts?.requireChecksums) {
      const sums = pack.checksums ?? {};
      if (pack.posterUrl && !sums.poster) {
        issues.push({ code: "checksum_poster", message: "checksum do poster ausente" });
      }
      if (pack.webmUrl && !sums.webm) {
        issues.push({ code: "checksum_webm", message: "checksum do webm ausente" });
      }
      if (pack.mp4Url && !sums.mp4) {
        issues.push({ code: "checksum_mp4", message: "checksum do mp4 ausente" });
      }
    }
  }

  return issues;
}

export function canTransitionStatus(from: SoldiersMediaStatus, to: SoldiersMediaStatus): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from].includes(to);
}

export function allowedStatusTransitions(from: SoldiersMediaStatus): SoldiersMediaStatus[] {
  return [...STATUS_TRANSITIONS[from]];
}

export function checksumsMatch(
  expected: SoldiersMediaAsset["checksums"],
  actual: SoldiersMediaAsset["checksums"],
): boolean {
  if (!expected || !actual) return true;
  const keys = ["poster", "thumbnail", "webm", "mp4", "gif"] as const;
  for (const key of keys) {
    const left = expected[key];
    const right = actual[key];
    if (left && right && left !== right) return false;
  }
  return true;
}

export function projectCatalogMediaStatus(
  pack: SoldiersMediaAsset,
): "missing" | "poster" | "motion" | "published" {
  if (pack.status === "published") return "published";
  if (pack.webmUrl?.trim() || pack.mp4Url?.trim()) return "motion";
  if (pack.posterUrl?.trim()) return "poster";
  return "missing";
}

export function computeMediaCoverage(input: MediaCoverageInputs): MediaCoverageReport {
  const byId = new Map<string, SoldiersMediaAsset>();
  for (const pack of input.packages) {
    if (pack.kind !== "exercise") continue;
    if ((pack.variant || MEDIA_VARIANT_DEFAULT) !== MEDIA_VARIANT_DEFAULT) continue;
    if ((pack.region || MEDIA_REGION_GLOBAL) !== MEDIA_REGION_GLOBAL) continue;
    byId.set(pack.entityId, pack);
  }

  let mediaComplete = 0;
  let posterMissing = 0;
  let thumbMissing = 0;
  let motionMissing = 0;
  let qaPending = 0;
  let published = 0;
  let rejected = 0;
  let legacy = 0;
  let externalUrls = 0;

  for (const ex of input.exercises) {
    const mediaId = (ex.mediaId || ex.id).trim();
    const pack = byId.get(mediaId);
    if (pack?.status === "published") published += 1;
    if (pack?.status === "rejected") rejected += 1;
    if (pack?.status === "qa") qaPending += 1;

    const hasPoster = Boolean(pack?.posterUrl?.trim());
    const hasThumb = Boolean(pack?.thumbnailUrl?.trim() || pack?.posterUrl?.trim());
    const hasMotion = Boolean(pack?.webmUrl?.trim() || pack?.mp4Url?.trim());
    const complete =
      pack?.status === "published" &&
      hasPoster &&
      hasThumb &&
      (!pack.needsMotion || hasMotion) &&
      validateMediaPackage(pack).length === 0;
    if (complete) mediaComplete += 1;
    if (!hasPoster) posterMissing += 1;
    if (!hasThumb) thumbMissing += 1;
    if (pack?.needsMotion && !hasMotion) motionMissing += 1;

    for (const url of [ex.mediaUrl, ex.videoUrl]) {
      if (!url?.trim()) continue;
      if (isSoldiersOwnedUrl(url)) continue;
      legacy += 1;
      if (isExternalMediaUrl(url)) externalUrls += 1;
    }
  }

  for (const row of input.cmsUrls ?? []) {
    if (!row.url?.trim()) continue;
    if (isSoldiersOwnedUrl(row.url) && row.authorized) continue;
    if (isSoldiersOwnedUrl(row.url)) {
      legacy += 1;
      continue;
    }
    legacy += 1;
    if (isExternalMediaUrl(row.url)) externalUrls += 1;
  }

  return {
    totalExercises: input.exercises.length,
    mediaComplete,
    posterMissing,
    thumbMissing,
    motionMissing,
    qaPending,
    published,
    rejected,
    legacy,
    externalUrls,
  };
}

export function normalizePackageStatus(raw: string | null | undefined): SoldiersMediaStatus {
  return normalizeMediaStatus(raw);
}
