/**
 * CMS overlays — in-memory cache hydrated from remote (cms_overrides).
 * localStorage is only used as a one-shot migration source until the first remote hydrate/save.
 * Production resolve only sees authorized Soldiers-owned URLs (filtered by getPublicCms).
 */
import { isSoldiersOwnedUrl } from "@/lib/soldiers-media-governance";

export interface CmsState {
  exerciseMedia: Record<string, string>;
  mealImages: Record<string, string>;
  workoutNotes: Record<string, string>;
  exerciseMediaAuthorized: Record<string, boolean>;
  mealImagesAuthorized: Record<string, boolean>;
}

const LOCAL_KEY = "soldiers-cms-v1";

export function emptyCmsState(): CmsState {
  return {
    exerciseMedia: {},
    mealImages: {},
    workoutNotes: {},
    exerciseMediaAuthorized: {},
    mealImagesAuthorized: {},
  };
}

let cache: CmsState = emptyCmsState();
let hydrated = false;

function cloneEmpty(): CmsState {
  return emptyCmsState();
}

function withAuthorized(parsed: Partial<CmsState>): CmsState {
  return {
    exerciseMedia: parsed.exerciseMedia ?? {},
    mealImages: parsed.mealImages ?? {},
    workoutNotes: parsed.workoutNotes ?? {},
    exerciseMediaAuthorized: parsed.exerciseMediaAuthorized ?? {},
    mealImagesAuthorized: parsed.mealImagesAuthorized ?? {},
  };
}

function readLegacyLocal(): CmsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CmsState>;
    return withAuthorized(parsed);
  } catch {
    return null;
  }
}

function clearLegacyLocal() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

function isEmpty(state: CmsState) {
  return (
    Object.keys(state.exerciseMedia).length === 0 &&
    Object.keys(state.mealImages).length === 0 &&
    Object.keys(state.workoutNotes).length === 0
  );
}

export function getCmsCache(): CmsState {
  return cache;
}

export function isCmsHydrated(): boolean {
  return hydrated;
}

/** Apply remote CMS into memory. Falls back to legacy local if remote empty. */
export function applyCmsState(remote: CmsState) {
  if (!isEmpty(remote)) {
    cache = withAuthorized(remote);
    clearLegacyLocal();
  } else {
    const legacy = readLegacyLocal();
    cache = legacy ?? cloneEmpty();
  }
  hydrated = true;
}

/** @deprecated Prefer applyCmsState after remote fetch. Kept for admin draft editing. */
export function loadCms(): CmsState {
  if (!hydrated) {
    const legacy = readLegacyLocal();
    if (legacy && !isEmpty(legacy)) return legacy;
  }
  return withAuthorized(cache);
}

/** Update in-memory cache after admin save (no localStorage write). */
export function setCmsCache(state: CmsState) {
  cache = withAuthorized(state);
  hydrated = true;
  clearLegacyLocal();
}

/** @deprecated No longer persists to localStorage. Use saveCmsRemote. */
export function saveCms(state: CmsState) {
  setCmsCache(state);
}

function productionCmsUrl(
  urls: Record<string, string>,
  authorized: Record<string, boolean>,
  id: string,
  fallback?: string,
) {
  const url = urls[id] || fallback;
  if (!url) return undefined;
  if (!authorized[id]) return undefined;
  if (!isSoldiersOwnedUrl(url)) return undefined;
  return url;
}

export function exerciseMediaUrl(id: string, fallback?: string) {
  return productionCmsUrl(cache.exerciseMedia, cache.exerciseMediaAuthorized, id, fallback);
}

export function mealImageUrl(id: string, fallback?: string) {
  return productionCmsUrl(cache.mealImages, cache.mealImagesAuthorized, id, fallback);
}

export function exerciseWorkoutNote(id: string): string | undefined {
  const note = cache.workoutNotes[id]?.trim();
  return note || undefined;
}

export function mergeCmsPreferRemote(remote: CmsState, local: CmsState): CmsState {
  if (!isEmpty(remote)) return withAuthorized(remote);
  return withAuthorized(local);
}

/** Public app hydrate: authorized + Soldiers-owned URLs only. */
export function publicCmsView(admin: CmsState): CmsState {
  const next = emptyCmsState();
  next.workoutNotes = { ...admin.workoutNotes };
  for (const [id, url] of Object.entries(admin.exerciseMedia)) {
    if (admin.exerciseMediaAuthorized[id] && isSoldiersOwnedUrl(url)) {
      next.exerciseMedia[id] = url;
      next.exerciseMediaAuthorized[id] = true;
    }
  }
  for (const [id, url] of Object.entries(admin.mealImages)) {
    if (admin.mealImagesAuthorized[id] && isSoldiersOwnedUrl(url)) {
      next.mealImages[id] = url;
      next.mealImagesAuthorized[id] = true;
    }
  }
  return next;
}

export { LOCAL_KEY as CMS_LOCAL_STORAGE_KEY };
