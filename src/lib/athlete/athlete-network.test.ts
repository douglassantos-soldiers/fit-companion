import { describe, expect, it } from "vitest";
import {
  activitiesFromGarminPayload,
  activitiesFromStravaPayload,
  activityFromLogEntry,
  activityFromSession,
  activityToLogEntry,
  dedupeActivities,
} from "@/lib/athlete/normalize";
import { activityDedupeKey } from "@/lib/athlete/types";
import {
  athleteProfileVisibleToViewer,
  buildAthleteProfile,
  publicAthletePayload,
} from "@/lib/athlete/profile";
import { DEFAULT_SOCIAL_PRIVACY } from "@/lib/social/visibility";
import type { SessionLog } from "@/lib/types";

const USER = "user-1";

const session: SessionLog = {
  id: "s1",
  dayId: "d1",
  title: "A",
  date: "2026-09-01",
  durationMin: 45,
  exercises: [],
  volumeKg: 1200,
};

describe("activity normalize", () => {
  it("maps Strava run payload", () => {
    const rows = activitiesFromStravaPayload(USER, [
      { id: 99, start_date: "2026-09-01T10:00:00Z", type: "Run", distance: 5000 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("strava");
    expect(rows[0]?.type).toBe("run");
    expect(rows[0]?.externalId).toBe("99");
    expect(rows[0]?.distanceM).toBe(5000);
    expect(rows[0]?.proofStatus).toBe("verified");
  });

  it("maps Garmin football payload", () => {
    const rows = activitiesFromGarminPayload(USER, [
      { activityId: 7, startTimeGMT: "2026-09-02T12:00:00Z", activityType: { typeKey: "soccer" } },
    ]);
    expect(rows[0]?.source).toBe("garmin");
    expect(rows[0]?.type).toBe("football");
  });

  it("maps app session to strength", () => {
    const row = activityFromSession(USER, session);
    expect(row.source).toBe("app");
    expect(row.type).toBe("strength");
    expect(row.externalId).toBe("s1");
    expect(row.durationSec).toBe(45 * 60);
  });

  it("dedupes by source+externalId", () => {
    const a = activityFromLogEntry(USER, {
      id: "strava:1",
      date: "2026-09-01",
      kind: "run_km",
      value: 5,
      source: "strava",
      status: "verified",
      externalId: "1",
    });
    const b = activityFromLogEntry(USER, {
      id: "strava:1-dup",
      date: "2026-09-01",
      kind: "run_km",
      value: 5.2,
      source: "strava",
      status: "verified",
      externalId: "1",
    });
    const deduped = dedupeActivities([a, b]);
    expect(deduped).toHaveLength(1);
    expect(activityDedupeKey(a)).toBe(activityDedupeKey(b));
    expect(deduped[0]?.metrics?.distanceKm).toBe(5.2);
  });

  it("adapts run/steps/football back to ActivityLogEntry", () => {
    const run = activitiesFromStravaPayload(USER, [
      { id: 1, start_date: "2026-09-01T10:00:00Z", type: "Run", distance: 2500 },
    ])[0]!;
    const log = activityToLogEntry(run);
    expect(log?.kind).toBe("run_km");
    expect(log?.value).toBe(2.5);
    expect(log?.source).toBe("strava");

    const steps = activityFromLogEntry(USER, {
      id: "g:steps",
      date: "2026-09-01",
      kind: "steps",
      value: 8000,
      source: "garmin",
      status: "verified",
      externalId: "s",
    });
    expect(activityToLogEntry(steps)?.kind).toBe("steps");
    expect(activityToLogEntry(activityFromSession(USER, session))).toBeNull();
  });
});

describe("athlete profile privacy", () => {
  const profile = buildAthleteProfile({
    userId: USER,
    performance: { sessions28d: 8, prCount: 2 },
    sessions: [session],
    activities: activitiesFromStravaPayload(USER, [
      { id: 1, start_date: "2026-09-01T10:00:00Z", type: "Run", distance: 5000 },
    ]),
    challenges: [{ challengeId: "c1", value: 3 }],
    graph: { followerCount: 4, followingCount: 2 },
  });

  it("omits nutrition, weight and photos from the public payload", () => {
    const json = JSON.stringify(publicAthletePayload(profile));
    expect(json).not.toMatch(/nutrition/i);
    expect(json).not.toMatch(/weight/i);
    expect(json).not.toMatch(/photo/i);
    expect(profile.prCount).toBe(2);
    expect(profile.preferredSports).toContain("run");
  });

  it("hides profile when blocked or muted", () => {
    const base = {
      viewerId: "viewer",
      authorId: USER,
      privacy: DEFAULT_SOCIAL_PRIVACY,
      viewerFollowsAuthor: true,
      authorFollowsViewer: true,
      sameClub: false,
      blockedEitherWay: false,
      muted: false,
    };
    expect(athleteProfileVisibleToViewer(base)).toBe(true);
    expect(athleteProfileVisibleToViewer({ ...base, blockedEitherWay: true })).toBe(false);
    expect(athleteProfileVisibleToViewer({ ...base, muted: true })).toBe(false);
  });
});
