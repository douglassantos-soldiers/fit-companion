/**
 * Pure social graph + privacy rules (Fase 12). No I/O.
 */
export type PrivacyLevel = "public" | "friends" | "private";
export type PrivacyKey = "profile" | "workouts" | "prs" | "weight" | "photos" | "nutrition";
export type SocialPrivacy = Record<PrivacyKey, PrivacyLevel>;
export type ReactionKind = "fire" | "muscle" | "clap" | "trophy" | "heart";

export const REACTION_KINDS: ReactionKind[] = ["fire", "muscle", "clap", "trophy", "heart"];

export const DEFAULT_SOCIAL_PRIVACY: SocialPrivacy = {
  profile: "public",
  workouts: "public",
  prs: "public",
  weight: "private",
  photos: "private",
  nutrition: "private",
};

const PRIVACY_LEVELS: PrivacyLevel[] = ["public", "friends", "private"];

export function isPrivacyLevel(value: unknown): value is PrivacyLevel {
  return value === "public" || value === "friends" || value === "private";
}

export function isReactionKind(value: unknown): value is ReactionKind {
  return REACTION_KINDS.includes(value as ReactionKind);
}

export function normalizeSocialPrivacy(raw: unknown, shareProgress = true): SocialPrivacy {
  const base = privacyFromLegacyShareProgress(shareProgress);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const pick = (key: PrivacyKey, fallback: PrivacyLevel): PrivacyLevel => {
    const v = o[key] ?? o[`privacy_${key}`];
    return isPrivacyLevel(v) ? v : fallback;
  };
  const photos = pick("photos", base.photos);
  return {
    profile: pick("profile", base.profile),
    workouts: pick("workouts", base.workouts),
    prs: pick("prs", base.prs),
    weight: pick("weight", "private") === "public" ? "private" : pick("weight", "private"),
    photos: photos === "public" ? "friends" : photos,
    nutrition: pick("nutrition", base.nutrition),
  };
}

/** shareProgress=false → profile/workouts/prs friends; weight/photos stay private. */
export function privacyFromLegacyShareProgress(share: boolean): SocialPrivacy {
  if (share) return { ...DEFAULT_SOCIAL_PRIVACY };
  return {
    ...DEFAULT_SOCIAL_PRIVACY,
    profile: "friends",
    workouts: "friends",
    prs: "friends",
  };
}

export function isFriendsRelation(opts: {
  viewerFollowsAuthor: boolean;
  authorFollowsViewer: boolean;
  sameClub: boolean;
}): boolean {
  return (opts.viewerFollowsAuthor && opts.authorFollowsViewer) || opts.sameClub;
}

export function canSeeContent(opts: {
  viewerId: string;
  authorId: string;
  level: PrivacyLevel;
  viewerFollowsAuthor: boolean;
  authorFollowsViewer: boolean;
  sameClub: boolean;
  blockedEitherWay: boolean;
}): boolean {
  if (opts.viewerId === opts.authorId) return true;
  if (opts.blockedEitherWay) return false;
  if (opts.level === "public") return true;
  if (opts.level === "private") return false;
  return isFriendsRelation({
    viewerFollowsAuthor: opts.viewerFollowsAuthor,
    authorFollowsViewer: opts.authorFollowsViewer,
    sameClub: opts.sameClub,
  });
}

export function canOpenProfile(opts: {
  viewerId: string;
  authorId: string;
  privacy: SocialPrivacy;
  viewerFollowsAuthor: boolean;
  authorFollowsViewer: boolean;
  sameClub: boolean;
  blockedEitherWay: boolean;
}): boolean {
  return canSeeContent({
    ...opts,
    level: opts.privacy.profile,
  });
}

export type FeedCandidate = {
  id: string;
  authorUserId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export function privacyKeyForEvent(kind: string, payload: Record<string, unknown> = {}): PrivacyKey {
  if (kind === "session") return "workouts";
  if (kind === "proof" && payload["hasBodyPhoto"] === true) return "photos";
  if (kind === "proof" && typeof payload["cardKind"] === "string" && payload["cardKind"] === "pr") {
    return "prs";
  }
  if (kind === "pr" || String(payload["prType"] ?? "").includes("PR")) return "prs";
  return "profile";
}

const SENSITIVE_PAYLOAD_KEYS = new Set([
  "weightKg",
  "weight_kg",
  "waistCm",
  "armCm",
  "chestCm",
  "hipCm",
  "thighCm",
  "waist_cm",
  "arm_cm",
  "chest_cm",
  "hip_cm",
  "thigh_cm",
  "storage_path",
  "storagePath",
]);

export function stripSensitiveSocialPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (SENSITIVE_PAYLOAD_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function shouldPublishEvent(privacy: SocialPrivacy, kind: string, payload: Record<string, unknown>): boolean {
  const key = privacyKeyForEvent(kind, payload);
  return privacy[key] !== "private";
}

const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export function isDismissalActive(createdAt: string, now = Date.now()): boolean {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return now - t < DISMISS_MS;
}

export function selectForYouFeed(opts: {
  viewerId: string;
  events: FeedCandidate[];
  followingIds: string[];
  followerIds: string[];
  clubUserIds: string[];
  blockedIds: string[];
  mutedIds: string[];
  dismissals: Array<{ authorUserId: string; kind: string; createdAt: string }>;
  privacyByUser: Record<string, SocialPrivacy>;
  now?: number;
}): FeedCandidate[] {
  const following = new Set(opts.followingIds);
  const followers = new Set(opts.followerIds);
  const club = new Set(opts.clubUserIds);
  const blocked = new Set(opts.blockedIds);
  const muted = new Set(opts.mutedIds);
  const now = opts.now ?? Date.now();
  const dismissed = new Set(
    opts.dismissals
      .filter((d) => isDismissalActive(d.createdAt, now))
      .map((d) => `${d.authorUserId}:${d.kind}`),
  );

  const kept = opts.events.filter((e) => {
    const author = e.authorUserId;
    if (!author) return false;
    if (author !== opts.viewerId && blocked.has(author)) return false;
    if (author !== opts.viewerId && muted.has(author)) return false;
    if (dismissed.has(`${author}:${e.kind}`)) return false;
    const inGraph = following.has(author) || club.has(author) || author === opts.viewerId;
    const isPr =
      e.kind === "proof" &&
      (e.payload["cardKind"] === "pr" || String(e.payload["prType"] ?? "").includes("PR"));
    const isPrKind = e.kind === "pr" || isPr;
    if (!inGraph && !isPrKind) return false;
    const privacy = opts.privacyByUser[author] ?? DEFAULT_SOCIAL_PRIVACY;
    const key = privacyKeyForEvent(e.kind, e.payload);
    return canSeeContent({
      viewerId: opts.viewerId,
      authorId: author,
      level: privacy[key],
      viewerFollowsAuthor: following.has(author),
      authorFollowsViewer: followers.has(author),
      sameClub: club.has(author),
      blockedEitherWay: blocked.has(author),
    });
  });

  return kept.sort((a, b) => {
    const aPrFollowed =
      following.has(a.authorUserId) && privacyKeyForEvent(a.kind, a.payload) === "prs" ? 1 : 0;
    const bPrFollowed =
      following.has(b.authorUserId) && privacyKeyForEvent(b.kind, b.payload) === "prs" ? 1 : 0;
    if (aPrFollowed !== bPrFollowed) return bPrFollowed - aPrFollowed;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function kudoKindFromLegacy(): ReactionKind {
  return "fire";
}

export function invitePendingKey(challengeId: string, fromUserId: string, toUserId: string) {
  return `${challengeId}:${fromUserId}:${toUserId}`;
}

/** Coarse flag: at least one of profile/workouts/prs is visible beyond the owner. */
export function isSocialSharingEnabled(privacy: SocialPrivacy): boolean {
  return privacy.profile !== "private" || privacy.workouts !== "private" || privacy.prs !== "private";
}

export function sanitizeCommentBody(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export { PRIVACY_LEVELS };
