/** CMS overlays (admin) — persisted locally until remote CMS exists. */

const KEY = "soldiers-cms-v1";

export interface CmsState {
  exerciseMedia: Record<string, string>;
  mealImages: Record<string, string>;
  workoutNotes: Record<string, string>;
}

const empty: CmsState = {
  exerciseMedia: {},
  mealImages: {},
  workoutNotes: {},
};

export function loadCms(): CmsState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw) as Partial<CmsState>;
    return {
      exerciseMedia: parsed.exerciseMedia ?? {},
      mealImages: parsed.mealImages ?? {},
      workoutNotes: parsed.workoutNotes ?? {},
    };
  } catch {
    return { ...empty };
  }
}

export function saveCms(state: CmsState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function exerciseMediaUrl(id: string, fallback?: string) {
  const cms = loadCms();
  return cms.exerciseMedia[id] || fallback;
}

export function mealImageUrl(id: string, fallback?: string) {
  const cms = loadCms();
  return cms.mealImages[id] || fallback;
}
