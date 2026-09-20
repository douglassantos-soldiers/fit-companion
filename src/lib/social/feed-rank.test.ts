import { describe, expect, it } from "vitest";
import { isEditorialDismissed, rankForYou, type RankableFeedItem } from "@/lib/social/feed-rank";

function item(partial: Partial<RankableFeedItem> & { id: string; authorUserId: string }): RankableFeedItem {
  return {
    kind: "session",
    payload: {},
    createdAt: "2026-09-19T11:00:00.000Z",
    ...partial,
  };
}

describe("rankForYou", () => {
  it("puts followed PR above club session", () => {
    const ranked = rankForYou(
      [
        item({ id: "club", authorUserId: "clubmate", createdAt: "2026-09-19T12:00:00.000Z" }),
        item({
          id: "pr",
          authorUserId: "followed",
          kind: "proof",
          payload: { cardKind: "pr" },
          createdAt: "2026-09-19T10:00:00.000Z",
        }),
      ],
      { followingIds: ["followed"], clubUserIds: ["clubmate"] },
    );
    expect(ranked.map((e) => e.id)).toEqual(["pr", "club"]);
  });

  it("penalizes seen-without-interaction after 2 impressions", () => {
    const ranked = rankForYou(
      [
        item({
          id: "seen",
          authorUserId: "followed",
          impressionCount: 2,
          interacted: false,
          createdAt: "2026-09-19T12:00:00.000Z",
        }),
        item({
          id: "fresh",
          authorUserId: "clubmate",
          impressionCount: 0,
          createdAt: "2026-09-19T11:00:00.000Z",
        }),
      ],
      { followingIds: ["followed"], clubUserIds: ["clubmate"] },
    );
    expect(ranked[0]?.id).toBe("fresh");
  });

  it("does not penalize seen items that were reacted", () => {
    const ranked = rankForYou(
      [
        item({
          id: "reacted",
          authorUserId: "followed",
          impressionCount: 3,
          interacted: true,
        }),
        item({ id: "club", authorUserId: "clubmate" }),
      ],
      { followingIds: ["followed"], clubUserIds: ["clubmate"] },
    );
    expect(ranked[0]?.id).toBe("reacted");
  });

  it("boosts editorial matching goal/level", () => {
    const ranked = rankForYou(
      [
        item({
          id: "ed",
          authorUserId: "me",
          kind: "editorial",
          editorialMatch: true,
          createdAt: "2026-09-19T09:00:00.000Z",
        }),
        item({
          id: "old-club",
          authorUserId: "stranger",
          createdAt: "2026-09-19T12:00:00.000Z",
        }),
      ],
      { followingIds: [], clubUserIds: [] },
    );
    expect(ranked[0]?.id).toBe("ed");
  });
});

describe("editorial dismiss", () => {
  it("hides dismissed content for 30 days", () => {
    expect(
      isEditorialDismissed("c1", [{ contentId: "c1", createdAt: "2026-09-10T00:00:00.000Z" }], Date.parse("2026-09-19T00:00:00.000Z")),
    ).toBe(true);
    expect(
      isEditorialDismissed("c1", [{ contentId: "c1", createdAt: "2026-07-01T00:00:00.000Z" }], Date.parse("2026-09-19T00:00:00.000Z")),
    ).toBe(false);
  });
});
