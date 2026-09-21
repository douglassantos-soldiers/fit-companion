/**
 * Shared URL / status helpers for Soldiers media CLI scripts.
 */
export const STATUSES = ["draft", "generated", "qa", "approved", "published", "rejected", "archived"];
export const MOTION_KINDS = new Set(["exercise", "brand", "howto"]);
const EXTERNAL_HOST_RE =
  /unsplash|gymvisual|gym-visual|opengym|open-gym|youtube|ytimg|wikimedia|pexels|pixabay|giphy/i;

export function isSoldiersOwnedUrl(url) {
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

export function isExternalMediaUrl(url) {
  const value = String(url ?? "").trim();
  if (!value) return false;
  if (isSoldiersOwnedUrl(value)) return false;
  if (EXTERNAL_HOST_RE.test(value)) return true;
  return /^https?:\/\//i.test(value);
}

export function normalizeStatus(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "pending") return "draft";
  if (STATUSES.includes(value)) return value;
  return "draft";
}
