/**
 * Fase 12 graph reads/writes via service_role.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import { contentExcerpt, matchesTarget, type PublicContentItem } from "@/lib/content-match";
import { pickEditorialItems } from "@/lib/content/recommend";
import { isEditorialDismissed, rankForYou } from "@/lib/social/feed-rank";
import {
  DEFAULT_SOCIAL_PRIVACY,
  isReactionKind,
  normalizeSocialPrivacy,
  selectForYouFeed,
  type FeedCandidate,
  type ReactionKind,
  type SocialPrivacy,
} from "@/lib/social/visibility";

type Row = Record<string, unknown>;

async function identityOrThrow(deviceId: string) {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) throw new Error("Identidade inválida");
  return identity;
}

function mapPrivacy(row: Row | null): SocialPrivacy {
  if (!row) return { ...DEFAULT_SOCIAL_PRIVACY };
  return normalizeSocialPrivacy({
    profile: row["privacy_profile"],
    workouts: row["privacy_workouts"],
    prs: row["privacy_prs"],
    weight: row["privacy_weight"],
    photos: row["privacy_photos"],
    nutrition: row["privacy_nutrition"],
  });
}

export async function loadGraphContext(userId: string) {
  const db = await adminDbLoose();
  if (!db) {
    return {
      followingIds: [] as string[],
      followerIds: [] as string[],
      blockedIds: [] as string[],
      mutedIds: [] as string[],
      clubUserIds: [] as string[],
      dismissals: [] as Array<{ authorUserId: string; kind: string; createdAt: string }>,
    };
  }

  const [following, followers, blocksOut, blocksIn, mutes, memberships, dismissals] =
    await Promise.all([
      db.from("social_follows").select("following_id").eq("follower_id", userId),
      db.from("social_follows").select("follower_id").eq("following_id", userId),
      db.from("social_blocks").select("blocked_id").eq("blocker_id", userId),
      db.from("social_blocks").select("blocker_id").eq("blocked_id", userId),
      db.from("social_mutes").select("muted_id").eq("user_id", userId),
      db.from("club_members").select("club_id").eq("user_id", userId),
      db.from("feed_dismissals").select("author_user_id, kind, created_at").eq("user_id", userId),
    ]);

  const followingIds = ((following.data ?? []) as Row[]).map((r) => String(r["following_id"]));
  const followerIds = ((followers.data ?? []) as Row[]).map((r) => String(r["follower_id"]));
  const blockedIds = [
    ...((blocksOut.data ?? []) as Row[]).map((r) => String(r["blocked_id"])),
    ...((blocksIn.data ?? []) as Row[]).map((r) => String(r["blocker_id"])),
  ];
  const mutedIds = ((mutes.data ?? []) as Row[]).map((r) => String(r["muted_id"]));
  const clubIds = ((memberships.data ?? []) as Row[])
    .map((r) => String(r["club_id"]))
    .filter(Boolean);

  let clubUserIds: string[] = [];
  if (clubIds.length) {
    const { data: members } = await db
      .from("club_members")
      .select("user_id")
      .in("club_id", clubIds);
    clubUserIds = [
      ...new Set(((members ?? []) as Row[]).map((r) => String(r["user_id"] ?? "")).filter(Boolean)),
    ];
  }

  return {
    followingIds,
    followerIds,
    blockedIds: [...new Set(blockedIds)],
    mutedIds,
    clubUserIds,
    dismissals: ((dismissals.data ?? []) as Row[]).map((r) => ({
      authorUserId: String(r["author_user_id"]),
      kind: String(r["kind"]),
      createdAt: String(r["created_at"]),
    })),
  };
}

function jsonRecord(
  payload: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (v == null) out[k] = null;
    else out[k] = JSON.stringify(v);
  }
  return out;
}

export type ForYouEvent = {
  id: string;
  deviceId: string;
  userId: string;
  displayName: string;
  kind: string;
  payload: Record<string, string | number | boolean | null>;
  kudosCount: number;
  createdAt: string;
  reactionCounts: Record<ReactionKind, number>;
  myReaction: ReactionKind | null;
  commentCount: number;
};

export async function getForYouFeedServer(
  deviceId: string,
  limit = 30,
  targeting?: { goal?: string | null; level?: string | null },
): Promise<{
  ok: boolean;
  events: ForYouEvent[];
  viewerUserId: string | null;
}> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) return { ok: false, events: [], viewerUserId: null };
  const db = await adminDbLoose();
  if (!db) return { ok: false, events: [], viewerUserId: identity.userId };

  const ctx = await loadGraphContext(identity.userId);
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await db
    .from("activity_events")
    .select("id, device_id, user_id, display_name, kind, payload, kudos_count, created_at")
    .is("hidden_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(120);

  const raw = ((rows ?? []) as Row[]).map((r) => ({
    id: String(r["id"]),
    deviceId: String(r["device_id"] ?? ""),
    userId: String(r["user_id"] ?? ""),
    displayName: String(r["display_name"] ?? "Soldado"),
    kind: String(r["kind"] ?? ""),
    payload: jsonRecord((r["payload"] as Record<string, unknown>) ?? {}),
    kudosCount: Number(r["kudos_count"] ?? 0),
    createdAt: String(r["created_at"] ?? ""),
  }));

  const authorIds = [...new Set(raw.map((e) => e.userId).filter(Boolean))];
  const privacyByUser: Record<string, SocialPrivacy> = {};
  if (authorIds.length) {
    const { data: profiles } = await db
      .from("social_profiles")
      .select(
        "app_user_id, privacy_profile, privacy_workouts, privacy_prs, privacy_weight, privacy_photos, privacy_nutrition",
      )
      .in("app_user_id", authorIds);
    for (const p of (profiles ?? []) as Row[]) {
      const id = String(p["app_user_id"] ?? "");
      if (id) privacyByUser[id] = mapPrivacy(p);
    }
  }

  const candidates: FeedCandidate[] = raw
    .filter((e) => e.userId)
    .map((e) => ({
      id: e.id,
      authorUserId: e.userId,
      kind: e.kind,
      payload: e.payload,
      createdAt: e.createdAt,
    }));

  const filtered = selectForYouFeed({
    viewerId: identity.userId,
    events: candidates,
    followingIds: ctx.followingIds,
    followerIds: ctx.followerIds,
    clubUserIds: ctx.clubUserIds,
    blockedIds: ctx.blockedIds,
    mutedIds: ctx.mutedIds,
    dismissals: ctx.dismissals,
    privacyByUser,
  });

  const socialIds = filtered.map((e) => e.id);
  const byId = new Map(raw.map((e) => [e.id, e]));
  const reactionCounts = emptyReactionMap();
  const myReaction: Record<string, ReactionKind> = {};
  const commentCount: Record<string, number> = {};

  const [impressionRes, contentImpressionRes, contentDismissRes, contentRes, contentProgressRes] =
    await Promise.all([
      db.from("feed_impressions").select("event_id").eq("user_id", identity.userId),
      db.from("content_impressions").select("content_id").eq("user_id", identity.userId),
      db.from("content_dismissals").select("content_id, created_at").eq("user_id", identity.userId),
      db
        .from("content_items")
        .select(
          "id, kind, title, body, media_url, goals, levels, published, sort_order, expert_id, collection_id, media_id, publish_at, unpublish_at, visible",
        )
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .limit(40),
      db
        .from("content_progress")
        .select("content_id, dismissed, saved")
        .eq("user_id", identity.userId),
    ]);

  if (socialIds.length) {
    const { data: reacts } = await db
      .from("activity_reactions")
      .select("event_id, user_id, kind")
      .in("event_id", socialIds);
    for (const r of (reacts ?? []) as Row[]) {
      const eid = String(r["event_id"]);
      const kind = r["kind"];
      if (!isReactionKind(kind)) continue;
      if (!reactionCounts[eid]) reactionCounts[eid] = emptyCounts();
      const bag = reactionCounts[eid] ?? emptyCounts();
      bag[kind] += 1;
      reactionCounts[eid] = bag;
      if (String(r["user_id"]) === identity.userId) myReaction[eid] = kind;
    }
    const { data: comments } = await db
      .from("activity_comments")
      .select("event_id")
      .in("event_id", socialIds)
      .is("hidden_at", null);
    for (const c of (comments ?? []) as Row[]) {
      const eid = String(c["event_id"]);
      commentCount[eid] = (commentCount[eid] ?? 0) + 1;
    }
  }

  const eventImpressions: Record<string, number> = {};
  for (const row of (impressionRes.data ?? []) as Row[]) {
    const id = String(row["event_id"] ?? "");
    if (!id) continue;
    eventImpressions[id] = (eventImpressions[id] ?? 0) + 1;
  }
  const contentImpressions: Record<string, number> = {};
  for (const row of (contentImpressionRes.data ?? []) as Row[]) {
    const id = String(row["content_id"] ?? "");
    if (!id) continue;
    contentImpressions[id] = (contentImpressions[id] ?? 0) + 1;
  }

  const published: PublicContentItem[] = ((contentRes.data ?? []) as Row[])
    .filter((r) => r["published"] !== false)
    .map((r) => {
      const media = r["media_url"] != null ? String(r["media_url"]) : "";
      const item: PublicContentItem = {
        id: String(r["id"] ?? ""),
        kind: r["kind"] as PublicContentItem["kind"],
        title: String(r["title"] ?? ""),
        body: String(r["body"] ?? ""),
        goals: Array.isArray(r["goals"]) ? (r["goals"] as unknown[]).map(String) : [],
        levels: Array.isArray(r["levels"]) ? (r["levels"] as unknown[]).map(String) : [],
        published: true,
        sortOrder: Number(r["sort_order"] ?? 0),
      };
      if (media) item.mediaUrl = media;
      return item;
    });

  const contentDismissals = ((contentDismissRes.data ?? []) as Row[]).map((r) => ({
    contentId: String(r["content_id"] ?? ""),
    createdAt: String(r["created_at"] ?? ""),
  }));
  const progress = [
    ...((contentProgressRes.data ?? []) as Row[]).map((r) => ({
      contentId: String(r["content_id"] ?? ""),
      dismissed: r["dismissed"] === true,
      saved: r["saved"] === true,
    })),
    ...contentDismissals.map((d) => ({ contentId: d.contentId, dismissed: true })),
  ];

  let snapshot: import("@/lib/engine/decision-context-snapshot").DecisionContextSnapshot | null =
    null;
  try {
    const { loadStoredDecisionContext } = await import("@/lib/engine/decision-context.server");
    const { todayKey } = await import("@/lib/types");
    const stored = await loadStoredDecisionContext(identity.userId, todayKey());
    snapshot = stored?.payload ?? null;
  } catch {
    snapshot = null;
  }

  const editorialOpts: Parameters<typeof pickEditorialItems>[1] = {
    date: new Date(),
    progress,
  };
  if (targeting?.goal !== undefined) editorialOpts.goal = targeting.goal;
  if (targeting?.level !== undefined) editorialOpts.level = targeting.level;
  if (snapshot) editorialOpts.snapshot = snapshot;

  const editorial = pickEditorialItems(published, editorialOpts, 2)
    .filter((item) => item.id && !isEditorialDismissed(item.id, contentDismissals))
    .map((item) => ({
      id: `editorial:${item.id}`,
      authorUserId: identity.userId,
      kind: "editorial",
      payload: {
        contentId: item.id,
        title: item.title,
        excerpt: contentExcerpt(item.body),
        href: `/conteudo/${item.id}`,
      },
      createdAt: new Date().toISOString(),
      impressionCount: contentImpressions[item.id] ?? 0,
      interacted: false,
      editorialMatch: matchesTarget(item, targeting?.goal, targeting?.level),
    }));

  const ranked = rankForYou(
    [
      ...filtered.map((e) => ({
        ...e,
        impressionCount: eventImpressions[e.id] ?? 0,
        interacted: Boolean(myReaction[e.id] || (commentCount[e.id] ?? 0) > 0),
      })),
      ...editorial,
    ],
    { followingIds: ctx.followingIds, clubUserIds: ctx.clubUserIds },
  ).slice(0, limit);

  return {
    ok: true,
    viewerUserId: identity.userId,
    events: ranked.map((s) => {
      if (s.kind === "editorial") {
        return {
          id: s.id,
          deviceId: "",
          userId: "",
          displayName: "Soldiers",
          kind: "editorial",
          payload: jsonRecord(s.payload),
          kudosCount: 0,
          createdAt: s.createdAt,
          reactionCounts: emptyCounts(),
          myReaction: null,
          commentCount: 0,
        };
      }
      const base = byId.get(s.id)!;
      const counts = reactionCounts[s.id] ?? emptyCounts();
      const fire = counts.fire;
      return {
        id: base.id,
        deviceId: base.deviceId,
        userId: base.userId,
        displayName: base.displayName,
        kind: base.kind,
        payload: base.payload,
        kudosCount: fire || base.kudosCount,
        createdAt: base.createdAt,
        reactionCounts: counts,
        myReaction: myReaction[s.id] ?? null,
        commentCount: commentCount[s.id] ?? 0,
      };
    }),
  };
}

function emptyCounts(): Record<ReactionKind, number> {
  return { fire: 0, muscle: 0, clap: 0, trophy: 0, heart: 0 };
}
function emptyReactionMap(): Record<string, Record<ReactionKind, number>> {
  return {};
}

export type SocialProfileResult =
  | { ok: false }
  | { ok: true; unavailable: true; viewerUserId: string }
  | {
      ok: true;
      unavailable: false;
      viewerUserId: string;
      isSelf: boolean;
      userId: string;
      displayName: string;
      bio: string;
      avatarUrl: string | null;
      followerCount: number;
      followingCount: number;
      viewerFollows: boolean;
      followsViewer: boolean;
      muted: boolean;
      blocked: boolean;
      privacy: SocialPrivacy;
      events: Array<{
        id: string;
        deviceId: string;
        userId: string;
        displayName: string;
        kind: string;
        payload: Record<string, string | number | boolean | null>;
        kudosCount: number;
        createdAt: string;
      }>;
      earnedBadges: string[];
      challenges: string[];
      evolution: { sessionCount: number; prCount: number };
    };

export async function getSocialProfileServer(
  deviceId: string,
  targetUserId: string,
): Promise<SocialProfileResult> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) return { ok: false as const };
  const db = await adminDbLoose();
  if (!db) return { ok: false as const };

  const ctx = await loadGraphContext(identity.userId);
  const blocked = ctx.blockedIds.includes(targetUserId);
  const { data: profile } = await db
    .from("social_profiles")
    .select("*")
    .eq("app_user_id", targetUserId)
    .maybeSingle();
  const privacy = mapPrivacy((profile ?? null) as Row | null);
  const viewerFollows = ctx.followingIds.includes(targetUserId);
  const followsViewer = ctx.followerIds.includes(targetUserId);
  const sameClub = ctx.clubUserIds.includes(targetUserId);

  const { canOpenProfile } = await import("@/lib/social/visibility");
  const open = canOpenProfile({
    viewerId: identity.userId,
    authorId: targetUserId,
    privacy,
    viewerFollowsAuthor: viewerFollows,
    authorFollowsViewer: followsViewer,
    sameClub,
    blockedEitherWay: blocked,
  });
  if (!open) {
    return { ok: true as const, unavailable: true as const, viewerUserId: identity.userId };
  }

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    db
      .from("social_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", targetUserId),
    db
      .from("social_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", targetUserId),
  ]);

  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await db
    .from("activity_events")
    .select("id, device_id, user_id, display_name, kind, payload, kudos_count, created_at")
    .eq("user_id", targetUserId)
    .is("hidden_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);

  const {
    canSeeContent,
    privacyKeyForEvent,
    stripSensitiveSocialPayload: strip,
  } = await import("@/lib/social/visibility");
  const visibleEvents = ((events ?? []) as Row[])
    .filter((r) => {
      const payload = (r["payload"] as Record<string, unknown>) ?? {};
      const key = privacyKeyForEvent(String(r["kind"] ?? ""), payload);
      if (key === "weight" || key === "photos") {
        if (privacy[key] === "private" && identity.userId !== targetUserId) return false;
      }
      return canSeeContent({
        viewerId: identity.userId,
        authorId: targetUserId,
        level: privacy[key],
        viewerFollowsAuthor: viewerFollows,
        authorFollowsViewer: followsViewer,
        sameClub,
        blockedEitherWay: blocked,
      });
    })
    .map((r) => ({
      id: String(r["id"]),
      deviceId: String(r["device_id"] ?? ""),
      userId: String(r["user_id"] ?? ""),
      displayName: String(r["display_name"] ?? "Soldado"),
      kind: String(r["kind"] ?? ""),
      payload: jsonRecord(strip((r["payload"] as Record<string, unknown>) ?? {})),
      kudosCount: Number(r["kudos_count"] ?? 0),
      createdAt: String(r["created_at"] ?? ""),
    }));

  const { data: stateRow } = await db
    .from("app_state")
    .select("retention, challenges, earned_badges")
    .eq("user_id", targetUserId)
    .maybeSingle();
  const retention =
    ((stateRow as Row | null)?.["retention"] as Record<string, unknown> | undefined) ?? {};
  const earnedBadges = Array.isArray(stateRow?.["earned_badges"])
    ? (stateRow!["earned_badges"] as string[])
    : Array.isArray(retention["earnedBadges"])
      ? (retention["earnedBadges"] as string[])
      : [];
  const challenges = Array.isArray(stateRow?.["challenges"])
    ? (stateRow!["challenges"] as string[])
    : Array.isArray(retention["challenges"])
      ? (retention["challenges"] as string[])
      : [];

  const showWeight = identity.userId === targetUserId || privacy.weight !== "private";
  void showWeight;

  return {
    ok: true as const,
    unavailable: false as const,
    viewerUserId: identity.userId,
    isSelf: identity.userId === targetUserId,
    userId: targetUserId,
    displayName: String((profile as Row | null)?.["display_name"] ?? "Soldado"),
    bio: String((profile as Row | null)?.["bio"] ?? ""),
    avatarUrl: ((profile as Row | null)?.["avatar_url"] as string | null) ?? null,
    followerCount: Number(followerCount ?? 0),
    followingCount: Number(followingCount ?? 0),
    viewerFollows,
    followsViewer,
    muted: ctx.mutedIds.includes(targetUserId),
    blocked,
    privacy,
    events: visibleEvents,
    earnedBadges,
    challenges,
    evolution: {
      sessionCount: visibleEvents.filter((e) => e.kind === "session").length,
      prCount: visibleEvents.filter((e) => e.kind === "proof" && e.payload["cardKind"] === "pr")
        .length,
    },
  };
}

export async function getAthleteProfileServer(deviceId: string, targetUserId: string) {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) return { ok: false as const };
  const db = await adminDbLoose();
  if (!db) return { ok: false as const };

  const ctx = await loadGraphContext(identity.userId);
  const blocked = ctx.blockedIds.includes(targetUserId);
  const muted = ctx.mutedIds.includes(targetUserId);
  const { data: profile } = await db
    .from("social_profiles")
    .select("*")
    .eq("app_user_id", targetUserId)
    .maybeSingle();
  const privacy = mapPrivacy((profile ?? null) as Row | null);
  const viewerFollows = ctx.followingIds.includes(targetUserId);
  const followsViewer = ctx.followerIds.includes(targetUserId);
  const sameClub = ctx.clubUserIds.includes(targetUserId);

  const { athleteProfileVisibleToViewer, buildAthleteProfile } =
    await import("@/lib/athlete/profile");
  const visible = athleteProfileVisibleToViewer({
    viewerId: identity.userId,
    authorId: targetUserId,
    privacy,
    viewerFollowsAuthor: viewerFollows,
    authorFollowsViewer: followsViewer,
    sameClub,
    blockedEitherWay: blocked,
    muted,
  });
  if (!visible) {
    return { ok: true as const, unavailable: true as const, viewerUserId: identity.userId };
  }

  const { listActivitiesForUser } = await import("@/lib/athlete/persist.server");
  const activities = await listActivitiesForUser(targetUserId);
  const [{ count: followerCount }, { count: followingCount }, sessionsRes, challengeRes, prRes] =
    await Promise.all([
      db
        .from("social_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", targetUserId),
      db
        .from("social_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", targetUserId),
      db
        .from("sessions")
        .select("id, date, duration_min, volume_kg, title, day_id")
        .eq("user_id", targetUserId)
        .limit(200),
      db.from("challenge_progress").select("challenge_id, value").eq("user_id", targetUserId),
      db
        .from("personal_records")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId),
    ]);

  const sessions = ((sessionsRes.data ?? []) as Row[]).map((r) => ({
    id: String(r["id"] ?? ""),
    dayId: String(r["day_id"] ?? ""),
    title: String(r["title"] ?? ""),
    date: String(r["date"] ?? ""),
    durationMin: Number(r["duration_min"] ?? 0),
    exercises: [],
    volumeKg: Number(r["volume_kg"] ?? 0),
  }));
  const since = new Date();
  since.setDate(since.getDate() - 28);
  const sinceKey = since.toISOString().slice(0, 10);
  const sessions28d = sessions.filter((s) => s.date >= sinceKey).length;

  const athlete = buildAthleteProfile({
    userId: targetUserId,
    performance: { sessions28d, prCount: Number(prRes.count ?? 0) },
    sessions,
    activities,
    challenges: ((challengeRes.data ?? []) as Row[]).map((r) => ({
      challengeId: String(r["challenge_id"] ?? ""),
      value: Number(r["value"] ?? 0),
    })),
    graph: {
      followerCount: Number(followerCount ?? 0),
      followingCount: Number(followingCount ?? 0),
    },
  });

  return {
    ok: true as const,
    unavailable: false as const,
    viewerUserId: identity.userId,
    isSelf: identity.userId === targetUserId,
    athlete,
  };
}

export async function listFollowsServer(
  deviceId: string,
  targetUserId: string,
  dir: "followers" | "following",
) {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity)
    return { ok: false as const, people: [] as Array<{ userId: string; displayName: string }> };
  const db = await adminDbLoose();
  if (!db) return { ok: false as const, people: [] };
  const ctx = await loadGraphContext(identity.userId);
  if (ctx.blockedIds.includes(targetUserId) && identity.userId !== targetUserId) {
    return { ok: true as const, people: [] };
  }
  const col = dir === "followers" ? "following_id" : "follower_id";
  const other = dir === "followers" ? "follower_id" : "following_id";
  const { data } = await db.from("social_follows").select(other).eq(col, targetUserId).limit(80);
  const ids = ((data ?? []) as Row[]).map((r) => String(r[other])).filter(Boolean);
  if (!ids.length) return { ok: true as const, people: [] };
  const { data: profiles } = await db
    .from("social_profiles")
    .select("app_user_id, display_name")
    .in("app_user_id", ids);
  const nameMap = new Map(
    ((profiles ?? []) as Row[]).map((p) => [
      String(p["app_user_id"]),
      String(p["display_name"] ?? "Soldado"),
    ]),
  );
  return {
    ok: true as const,
    viewerUserId: identity.userId,
    people: ids.map((id) => ({ userId: id, displayName: nameMap.get(id) ?? "Soldado" })),
  };
}

export async function listFollowingForInviteServer(deviceId: string) {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity)
    return { ok: false as const, people: [] as Array<{ userId: string; displayName: string }> };
  const listed = await listFollowsServer(deviceId, identity.userId, "following");
  return listed;
}

export async function listEventCommentsServer(deviceId: string, eventId: string) {
  await identityOrThrow(deviceId);
  const db = await adminDbLoose();
  if (!db) return { ok: false as const, comments: [] };
  const { data } = await db
    .from("activity_comments")
    .select("id, user_id, body, created_at")
    .eq("event_id", eventId)
    .is("hidden_at", null)
    .order("created_at", { ascending: true })
    .limit(40);
  const rows = (data ?? []) as Row[];
  const userIds = [...new Set(rows.map((r) => String(r["user_id"])))];
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await db
      .from("social_profiles")
      .select("app_user_id, display_name")
      .in("app_user_id", userIds);
    for (const p of (profiles ?? []) as Row[]) {
      names.set(String(p["app_user_id"]), String(p["display_name"] ?? "Soldado"));
    }
  }
  return {
    ok: true as const,
    comments: rows.map((r) => ({
      id: String(r["id"]),
      userId: String(r["user_id"]),
      displayName: names.get(String(r["user_id"])) ?? "Soldado",
      body: String(r["body"] ?? ""),
      createdAt: String(r["created_at"] ?? ""),
    })),
  };
}

export async function savePrivacyServer(deviceId: string, privacy: SocialPrivacy) {
  const identity = await identityOrThrow(deviceId);
  const db = await adminDbLoose();
  if (!db) return { ok: false as const };
  const next = normalizeSocialPrivacy(privacy);
  const { error } = await db
    .from("social_profiles")
    .update({
      privacy_profile: next.profile,
      privacy_workouts: next.workouts,
      privacy_prs: next.prs,
      privacy_weight: next.weight,
      privacy_photos: next.photos,
      privacy_nutrition: next.nutrition,
      updated_at: new Date().toISOString(),
    })
    .eq("app_user_id", identity.userId);
  if (error) {
    console.error("savePrivacy failed", error);
    return { ok: false as const };
  }
  return { ok: true as const, privacy: next };
}

export async function listPendingInvitesServer(deviceId: string) {
  const identity = await identityOrThrow(deviceId);
  const db = await adminDbLoose();
  if (!db) return { ok: false as const, invites: [] };
  const { data } = await db
    .from("challenge_invites")
    .select("id, challenge_id, from_user_id, status, created_at")
    .eq("to_user_id", identity.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);
  const fromIds = ((data ?? []) as Row[]).map((r) => String(r["from_user_id"]));
  const names = new Map<string, string>();
  if (fromIds.length) {
    const { data: profiles } = await db
      .from("social_profiles")
      .select("app_user_id, display_name")
      .in("app_user_id", fromIds);
    for (const p of (profiles ?? []) as Row[]) {
      names.set(String(p["app_user_id"]), String(p["display_name"] ?? "Soldado"));
    }
  }
  return {
    ok: true as const,
    invites: ((data ?? []) as Row[]).map((r) => ({
      id: String(r["id"]),
      challengeId: String(r["challenge_id"]),
      fromUserId: String(r["from_user_id"]),
      fromName: names.get(String(r["from_user_id"])) ?? "Soldado",
      createdAt: String(r["created_at"]),
    })),
  };
}
