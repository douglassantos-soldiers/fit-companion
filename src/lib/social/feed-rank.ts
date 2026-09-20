/**
 * Rule-based For You ranking (Fase 16). No ML.
 * Filter stays in selectForYouFeed; this scores visto / seguido / editorial / recência.
 */
import type { FeedCandidate } from "@/lib/social/visibility";

export type RankableFeedItem = FeedCandidate & {
  impressionCount?: number;
  interacted?: boolean;
  editorialMatch?: boolean;
};

function isPr(e: FeedCandidate): boolean {
  if (e.kind === "pr") return true;
  if (e.kind !== "proof") return false;
  return e.payload["cardKind"] === "pr" || String(e.payload["prType"] ?? "").includes("PR");
}

export function forYouScore(
  e: RankableFeedItem,
  following: Set<string>,
  club: Set<string>,
): number {
  const ts = Date.parse(e.createdAt);
  const recency = Number.isFinite(ts) ? ts / 1e13 : 0;
  let score = recency;
  if (following.has(e.authorUserId)) score += 20;
  if (club.has(e.authorUserId) && e.authorUserId) score += 10;
  if (isPr(e) && following.has(e.authorUserId)) score += 30;
  if (e.kind === "editorial" && e.editorialMatch) score += 15;
  if ((e.impressionCount ?? 0) >= 2 && !e.interacted) score -= 25;
  return score;
}

export function rankForYou(
  items: RankableFeedItem[],
  opts: { followingIds: string[]; clubUserIds: string[] },
): RankableFeedItem[] {
  const following = new Set(opts.followingIds);
  const club = new Set(opts.clubUserIds);
  return [...items].sort((a, b) => {
    const diff = forYouScore(b, following, club) - forYouScore(a, following, club);
    if (diff !== 0) return diff;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function isEditorialDismissed(
  contentId: string,
  dismissals: Array<{ contentId: string; createdAt: string }>,
  now = Date.now(),
): boolean {
  const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;
  return dismissals.some((d) => {
    if (d.contentId !== contentId) return false;
    const t = Date.parse(d.createdAt);
    return Number.isFinite(t) && now - t < DISMISS_MS;
  });
}
