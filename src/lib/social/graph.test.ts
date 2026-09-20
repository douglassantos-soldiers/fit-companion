import { describe, expect, it } from "vitest";
import {
  canSeeContent,
  DEFAULT_SOCIAL_PRIVACY,
  invitePendingKey,
  isDismissalActive,
  kudoKindFromLegacy,
  normalizeSocialPrivacy,
  privacyFromLegacyShareProgress,
  sanitizeCommentBody,
  selectForYouFeed,
  shouldPublishEvent,
  stripSensitiveSocialPayload,
  type FeedCandidate,
  type SocialPrivacy,
} from "@/lib/social/visibility";

const now = Date.parse("2026-09-19T12:00:00.000Z");

function event(partial: Partial<FeedCandidate> & { id: string; authorUserId: string }): FeedCandidate {
  return {
    kind: "session",
    payload: {},
    createdAt: "2026-09-19T11:00:00.000Z",
    ...partial,
  };
}

describe("privacy mapping", () => {
  it("defaults weight and photos to private", () => {
    expect(DEFAULT_SOCIAL_PRIVACY.weight).toBe("private");
    expect(DEFAULT_SOCIAL_PRIVACY.photos).toBe("private");
    expect(DEFAULT_SOCIAL_PRIVACY.nutrition).toBe("private");
  });

  it("maps shareProgress=false to friends for profile/workouts/prs", () => {
    const p = privacyFromLegacyShareProgress(false);
    expect(p.profile).toBe("friends");
    expect(p.workouts).toBe("friends");
    expect(p.prs).toBe("friends");
    expect(p.weight).toBe("private");
  });

  it("never allows public weight and coerces public photos to friends", () => {
    const p = normalizeSocialPrivacy({ weight: "public", photos: "public" });
    expect(p.weight).toBe("private");
    expect(p.photos).toBe("friends");
  });
});

describe("visibility graph", () => {
  it("follow/unfollow is a friends relation only when reciprocal or same club", () => {
    expect(
      canSeeContent({
        viewerId: "a",
        authorId: "b",
        level: "friends",
        viewerFollowsAuthor: true,
        authorFollowsViewer: false,
        sameClub: false,
        blockedEitherWay: false,
      }),
    ).toBe(false);
    expect(
      canSeeContent({
        viewerId: "a",
        authorId: "b",
        level: "friends",
        viewerFollowsAuthor: true,
        authorFollowsViewer: true,
        sameClub: false,
        blockedEitherWay: false,
      }),
    ).toBe(true);
  });

  it("block cuts visibility in either direction", () => {
    expect(
      canSeeContent({
        viewerId: "a",
        authorId: "b",
        level: "public",
        viewerFollowsAuthor: true,
        authorFollowsViewer: true,
        sameClub: true,
        blockedEitherWay: true,
      }),
    ).toBe(false);
  });

  it("private is owner-only", () => {
    expect(
      canSeeContent({
        viewerId: "a",
        authorId: "b",
        level: "private",
        viewerFollowsAuthor: true,
        authorFollowsViewer: true,
        sameClub: true,
        blockedEitherWay: false,
      }),
    ).toBe(false);
    expect(
      canSeeContent({
        viewerId: "b",
        authorId: "b",
        level: "private",
        viewerFollowsAuthor: false,
        authorFollowsViewer: false,
        sameClub: false,
        blockedEitherWay: false,
      }),
    ).toBe(true);
  });
});

describe("for-you feed", () => {
  const privacy: Record<string, SocialPrivacy> = {
    clubmate: DEFAULT_SOCIAL_PRIVACY,
    followed: DEFAULT_SOCIAL_PRIVACY,
    stranger: DEFAULT_SOCIAL_PRIVACY,
    privateWeight: { ...DEFAULT_SOCIAL_PRIVACY, weight: "private", photos: "private" },
  };

  it("includes club + followed and boosts followed PRs", () => {
    const selected = selectForYouFeed({
      viewerId: "me",
      followingIds: ["followed"],
      followerIds: ["followed"],
      clubUserIds: ["clubmate"],
      blockedIds: [],
      mutedIds: [],
      dismissals: [],
      privacyByUser: privacy,
      now,
      events: [
        event({ id: "club-session", authorUserId: "clubmate", kind: "session", createdAt: "2026-09-19T10:00:00.000Z" }),
        event({
          id: "pr",
          authorUserId: "followed",
          kind: "proof",
          payload: { cardKind: "pr" },
          createdAt: "2026-09-19T09:00:00.000Z",
        }),
        event({ id: "noise", authorUserId: "stranger", kind: "session", createdAt: "2026-09-19T11:00:00.000Z" }),
      ],
    });
    expect(selected.map((e) => e.id)).toEqual(["pr", "club-session"]);
  });

  it("mute hides from feed and dismissal excludes author+kind for 30d", () => {
    const selected = selectForYouFeed({
      viewerId: "me",
      followingIds: ["followed"],
      followerIds: [],
      clubUserIds: [],
      blockedIds: [],
      mutedIds: ["muted"],
      dismissals: [{ authorUserId: "followed", kind: "session", createdAt: "2026-09-18T12:00:00.000Z" }],
      privacyByUser: privacy,
      now,
      events: [
        event({ id: "muted-session", authorUserId: "muted", kind: "session" }),
        event({ id: "dismissed", authorUserId: "followed", kind: "session" }),
        event({
          id: "kept-pr",
          authorUserId: "followed",
          kind: "proof",
          payload: { cardKind: "pr" },
        }),
      ],
    });
    expect(selected.map((e) => e.id)).toEqual(["kept-pr"]);
  });

  it("keeps weight and body photos private even with follow", () => {
    expect(shouldPublishEvent(privacy["privateWeight"]!, "proof", { hasBodyPhoto: true })).toBe(false);
    const selected = selectForYouFeed({
      viewerId: "me",
      followingIds: ["privateWeight"],
      followerIds: ["privateWeight"],
      clubUserIds: [],
      blockedIds: [],
      mutedIds: [],
      dismissals: [],
      privacyByUser: privacy,
      now,
      events: [
        event({
          id: "photo",
          authorUserId: "privateWeight",
          kind: "proof",
          payload: { hasBodyPhoto: true },
        }),
      ],
    });
    expect(selected).toHaveLength(0);
    expect(stripSensitiveSocialPayload({ weightKg: 80, title: "treino", waistCm: 80 })).toEqual({
      title: "treino",
    });
  });
});

describe("legacy kudo and invites", () => {
  it("maps kudo to fire", () => {
    expect(kudoKindFromLegacy()).toBe("fire");
  });

  it("builds unique pending invite keys", () => {
    expect(invitePendingKey("c1", "a", "b")).toBe("c1:a:b");
    expect(invitePendingKey("c1", "a", "b")).not.toBe(invitePendingKey("c1", "b", "a"));
  });

  it("sanitizes comments to 280 chars without tags", () => {
    expect(sanitizeCommentBody("  <b>oi</b>  ")).toBe("oi");
    expect(sanitizeCommentBody("x".repeat(400)).length).toBe(280);
  });

  it("dismissal lasts 30 days", () => {
    expect(isDismissalActive("2026-08-21T12:00:00.000Z", now)).toBe(true);
    expect(isDismissalActive("2026-08-18T12:00:00.000Z", now)).toBe(false);
  });
});
