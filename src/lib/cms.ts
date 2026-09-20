/**
 * CMS overlays — in-memory cache hydrated from remote (cms_overrides).
 * localStorage is only used as a one-shot migration source until the first remote hydrate/save.
 */

export interface CmsState {
  exerciseMedia: Record<string, string>;
  mealImages: Record<string, string>;
  workoutNotes: Record<string, string>;
}

const LOCAL_KEY = "soldiers-cms-v1";

const empty: CmsState = {
  exerciseMedia: {},
  mealImages: {},
  workoutNotes: {},
};

let cache: CmsState = { ...empty, exerciseMedia: {}, mealImages: {}, workoutNotes: {} };
let hydrated = false;

function cloneEmpty(): CmsState {
  return { exerciseMedia: {}, mealImages: {}, workoutNotes: {} };
}

function readLegacyLocal(): CmsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CmsState>;
    return {
      exerciseMedia: parsed.exerciseMedia ?? {},
      mealImages: parsed.mealImages ?? {},
      workoutNotes: parsed.workoutNotes ?? {},
    };
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
    cache = {
      exerciseMedia: { ...remote.exerciseMedia },
      mealImages: { ...remote.mealImages },
      workoutNotes: { ...remote.workoutNotes },
    };
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
  return {
    exerciseMedia: { ...cache.exerciseMedia },
    mealImages: { ...cache.mealImages },
    workoutNotes: { ...cache.workoutNotes },
  };
}

/** Update in-memory cache after admin save (no localStorage write). */
export function setCmsCache(state: CmsState) {
  cache = {
    exerciseMedia: { ...state.exerciseMedia },
    mealImages: { ...state.mealImages },
    workoutNotes: { ...state.workoutNotes },
  };
  hydrated = true;
  clearLegacyLocal();
}

/** @deprecated No longer persists to localStorage. Use saveCmsRemote. */
export function saveCms(state: CmsState) {
  setCmsCache(state);
}

export function exerciseMediaUrl(id: string, fallback?: string) {
  return cache.exerciseMedia[id] || fallback;
}

export function mealImageUrl(id: string, fallback?: string) {
  return cache.mealImages[id] || fallback;
}

export function exerciseWorkoutNote(id: string): string | undefined {
  const note = cache.workoutNotes[id]?.trim();
  return note || undefined;
}

export function mergeCmsPreferRemote(remote: CmsState, local: CmsState): CmsState {
  if (!isEmpty(remote)) return remote;
  return local;
}

export { LOCAL_KEY as CMS_LOCAL_STORAGE_KEY };
