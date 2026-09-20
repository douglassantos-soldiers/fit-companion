/**
 * Fase 11 — medidas corporais e fotos de evolução (privadas por padrão).
 * Sem valores no payload analítico; path nunca usa o bucket público checkins.
 */
import type {
  BodyMeasurementEntry,
  PhotoPose,
  PhotoVisibility,
  ProgressPhotoEntry,
  WeightEntry,
} from "@/lib/types";

export const PHOTO_POSES: PhotoPose[] = ["front", "side", "back"];
export const DEFAULT_PHOTO_VISIBILITY: PhotoVisibility = "private";
export const PROGRESS_PHOTOS_BUCKET = "progress-photos";
export const SIGNED_URL_TTL_SEC = 3600;
export const PHOTO_MAX_EDGE_PX = 1600;
export const PHOTO_JPEG_QUALITY = 0.8;

export const BODY_SITES = [
  { key: "waistCm", db: "waist_cm", label: "Cintura" },
  { key: "armCm", db: "arm_cm", label: "Braço" },
  { key: "chestCm", db: "chest_cm", label: "Peito" },
  { key: "hipCm", db: "hip_cm", label: "Quadril" },
  { key: "thighCm", db: "thigh_cm", label: "Coxa" },
] as const;

export type BodySiteKey = (typeof BODY_SITES)[number]["key"];

export const POSE_LABEL: Record<PhotoPose, string> = {
  front: "Frente",
  side: "Lado",
  back: "Costas",
};

export function emptyMeasurement(date: string): BodyMeasurementEntry {
  return {
    date,
    waistCm: null,
    armCm: null,
    chestCm: null,
    hipCm: null,
    thighCm: null,
  };
}

export function parseCm(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 400) return null;
  return Math.round(n * 10) / 10;
}

export function mergeMeasurementsByDate(
  remote: BodyMeasurementEntry[] = [],
  local: BodyMeasurementEntry[] = [],
): BodyMeasurementEntry[] {
  const byDate = new Map<string, BodyMeasurementEntry>();
  for (const row of remote) {
    const date = String(row.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    byDate.set(date, { ...emptyMeasurement(date), ...row, date });
  }
  for (const row of local) {
    const date = String(row.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    byDate.set(date, { ...emptyMeasurement(date), ...row, date });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeProgressPhotos(
  remote: ProgressPhotoEntry[] = [],
  local: ProgressPhotoEntry[] = [],
): ProgressPhotoEntry[] {
  const bySlot = new Map<string, ProgressPhotoEntry>();
  for (const photo of [...remote, ...local]) {
    const normalized = normalizePhoto(photo);
    if (!normalized) continue;
    bySlot.set(`${normalized.takenOn}:${normalized.pose}`, normalized);
  }
  return [...bySlot.values()].sort((a, b) =>
    a.takenOn === b.takenOn ? a.pose.localeCompare(b.pose) : a.takenOn.localeCompare(b.takenOn),
  );
}

export function normalizePhoto(raw: ProgressPhotoEntry | null | undefined): ProgressPhotoEntry | null {
  if (!raw) return null;
  const id = String(raw.id ?? "").trim();
  const takenOn = String(raw.takenOn ?? "").slice(0, 10);
  const pose = raw.pose;
  const storagePath = String(raw.storagePath ?? "").trim();
  if (!id || !isPhotoPose(pose) || !/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) return null;
  if (!isValidProgressPhotoPath(storagePath)) return null;
  return {
    id,
    takenOn,
    pose,
    storagePath,
    visibility: isPhotoVisibility(raw.visibility) ? raw.visibility : DEFAULT_PHOTO_VISIBILITY,
  };
}

export function isPhotoPose(value: unknown): value is PhotoPose {
  return value === "front" || value === "side" || value === "back";
}

export function isPhotoVisibility(value: unknown): value is PhotoVisibility {
  return value === "private" || value === "card" || value === "feed";
}

export function buildProgressPhotoPath(opts: {
  authUserId: string;
  takenOn: string;
  pose: PhotoPose;
  id: string;
}): string {
  return `${opts.authUserId}/${opts.takenOn}/${opts.pose}-${opts.id}.jpg`;
}

/** Original body photos must never live under the public checkins bucket. */
export function isPrivateProgressPhotoPath(path: string): boolean {
  const p = String(path ?? "").replace(/^\/+/, "");
  if (!p) return false;
  if (p.startsWith("checkins/") || p.includes("/checkins/")) return false;
  return !p.toLowerCase().startsWith("checkins");
}

export function isValidProgressPhotoPath(path: string, authUserId?: string): boolean {
  const p = String(path ?? "").replace(/^\/+/, "");
  if (!isPrivateProgressPhotoPath(p)) return false;
  const parts = p.split("/");
  if (parts.length !== 3) return false;
  const folder = parts[0] ?? "";
  const date = parts[1] ?? "";
  const file = parts[2] ?? "";
  if (!folder || folder === "checkins") return false;
  if (authUserId && folder !== authUserId) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (!/^(front|side|back)-[a-zA-Z0-9-]+\.jpe?g$/i.test(file)) return false;
  return true;
}

export function mapMeasurementRow(row: Record<string, unknown>): BodyMeasurementEntry | null {
  const date = String(row["date"] ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    date,
    waistCm: parseCm(row["waist_cm"] ?? row["waistCm"]),
    armCm: parseCm(row["arm_cm"] ?? row["armCm"]),
    chestCm: parseCm(row["chest_cm"] ?? row["chestCm"]),
    hipCm: parseCm(row["hip_cm"] ?? row["hipCm"]),
    thighCm: parseCm(row["thigh_cm"] ?? row["thighCm"]),
  };
}

export function measurementToRow(entry: BodyMeasurementEntry) {
  return {
    date: entry.date.slice(0, 10),
    waist_cm: entry.waistCm,
    arm_cm: entry.armCm,
    chest_cm: entry.chestCm,
    hip_cm: entry.hipCm,
    thigh_cm: entry.thighCm,
  };
}

export function mapPhotoRow(row: Record<string, unknown>): ProgressPhotoEntry | null {
  return normalizePhoto({
    id: String(row["id"] ?? row["client_id"] ?? ""),
    takenOn: String(row["taken_on"] ?? row["takenOn"] ?? "").slice(0, 10),
    pose: row["pose"] as PhotoPose,
    storagePath: String(row["storage_path"] ?? row["storagePath"] ?? ""),
    visibility: (row["visibility"] as PhotoVisibility) ?? DEFAULT_PHOTO_VISIBILITY,
  });
}

export function photoToRow(photo: ProgressPhotoEntry) {
  return {
    id: photo.id,
    taken_on: photo.takenOn,
    pose: photo.pose,
    storage_path: photo.storagePath,
    visibility: photo.visibility,
  };
}

/** Analytics payload — never include cm values. */
export function measurementsLoggedPayload(date: string): { logged: true; date: string } {
  return { logged: true, date: date.slice(0, 10) };
}

export interface EvolutionDeltas {
  firstDate: string | null;
  lastDate: string | null;
  weightKg: number | null;
  waistCm: number | null;
  armCm: number | null;
  chestCm: number | null;
  hipCm: number | null;
  thighCm: number | null;
}

export function evolutionDeltas(
  weights: WeightEntry[],
  measurements: BodyMeasurementEntry[],
): EvolutionDeltas {
  const w = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const m = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const firstW = w[0];
  const lastW = w[w.length - 1];
  const firstM = m[0];
  const lastM = m[m.length - 1];
  const dates = [firstW?.date, lastW?.date, firstM?.date, lastM?.date].filter(Boolean) as string[];
  dates.sort();
  return {
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    weightKg: delta(firstW?.weightKg, lastW?.weightKg),
    waistCm: delta(firstM?.waistCm, lastM?.waistCm),
    armCm: delta(firstM?.armCm, lastM?.armCm),
    chestCm: delta(firstM?.chestCm, lastM?.chestCm),
    hipCm: delta(firstM?.hipCm, lastM?.hipCm),
    thighCm: delta(firstM?.thighCm, lastM?.thighCm),
  };
}

function delta(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from == null || to == null) return null;
  return Math.round((to - from) * 10) / 10;
}

export function photosEligibleForCard(photos: ProgressPhotoEntry[]): ProgressPhotoEntry[] {
  return photos.filter((p) => p.visibility === "card" || p.visibility === "feed");
}

export function shouldIncludePhotosInEvolutionCard(opts: {
  includePhotosToggle: boolean;
  photos: ProgressPhotoEntry[];
}): boolean {
  return opts.includePhotosToggle === true && photosEligibleForCard(opts.photos).length > 0;
}

export function datesForPose(photos: ProgressPhotoEntry[], pose: PhotoPose): string[] {
  return [...new Set(photos.filter((p) => p.pose === pose).map((p) => p.takenOn))].sort();
}

export function photoForPoseOnDate(
  photos: ProgressPhotoEntry[],
  pose: PhotoPose,
  date: string,
): ProgressPhotoEntry | undefined {
  return photos.find((p) => p.pose === pose && p.takenOn === date);
}

export function formatCmDelta(n: number | null): string | null {
  if (n == null) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("pt-BR")} cm`;
}

export function formatKgDelta(n: number | null): string | null {
  if (n == null) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("pt-BR")} kg`;
}
