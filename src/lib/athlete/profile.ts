/**
 * Derived athlete profile — no nutrition, weight, or progress photos.
 */
import type { Activity, ActivityType } from "@/lib/athlete/types";
import type { Athlete360, Performance360 } from "@/lib/customer360/types";
import { streak } from "@/lib/engine/dimensions";
import type { SessionLog } from "@/lib/types";
import { canOpenProfile, isFriendsRelation, type SocialPrivacy } from "@/lib/social/visibility";

export type AthleteProofSummary = {
  verified: number;
  selfReported: number;
  pending: number;
};

export type AthleteProfile = {
  userId: string;
  sessionCount28d: number;
  sessionCountTotal: number;
  streakDays: number;
  prCount: number;
  preferredSports: ActivityType[];
  activityCount28d: number;
  cardioVolume28d: { distanceM: number; durationSec: number };
  consistencyScore: number;
  proofSummary: AthleteProofSummary;
  challengeCount: number;
  followerCount: number;
  followingCount: number;
};

export type ChallengeHistoryRow = {
  challengeId: string;
  value: number;
};

export type AthleteGraphCounts = {
  followerCount: number;
  followingCount: number;
};

const CARDIO_TYPES: ActivityType[] = ["run", "walk", "cycling", "cardio", "football"];

function daysAgoIso(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function preferredSportsFromActivities(activities: Activity[], limit = 3): ActivityType[] {
  const counts = new Map<ActivityType, number>();
  for (const a of activities) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([type]) => type);
}

export function proofSummaryOf(activities: Activity[]): AthleteProofSummary {
  const summary: AthleteProofSummary = { verified: 0, selfReported: 0, pending: 0 };
  for (const a of activities) {
    if (a.proofStatus === "verified") summary.verified += 1;
    else if (a.proofStatus === "pending") summary.pending += 1;
    else summary.selfReported += 1;
  }
  return summary;
}

export function buildAthlete360(opts: {
  sessions: SessionLog[];
  activities: Activity[];
  now?: Date;
}): Athlete360 {
  const now = opts.now ?? new Date();
  const since = daysAgoIso(28, now);
  const recent = opts.activities.filter((a) => a.startedAt >= since);
  const proof = proofSummaryOf(opts.activities);
  const total = proof.verified + proof.selfReported + proof.pending;
  return {
    sessionCountTotal: opts.sessions.length,
    preferredSports: preferredSportsFromActivities(opts.activities),
    activityCount28d: recent.length,
    verifiedShare: total ? Math.round((proof.verified / total) * 100) / 100 : 0,
  };
}

export function buildAthleteProfile(opts: {
  userId: string;
  performance: Pick<Performance360, "sessions28d" | "prCount">;
  sessions: SessionLog[];
  activities: Activity[];
  challenges?: ChallengeHistoryRow[];
  graph?: AthleteGraphCounts;
  freezeUsedDates?: string[];
  now?: Date;
}): AthleteProfile {
  const now = opts.now ?? new Date();
  const since = daysAgoIso(28, now);
  const recent = opts.activities.filter((a) => a.startedAt >= since);
  const cardio = recent.filter((a) => CARDIO_TYPES.includes(a.type));
  const distanceM = cardio.reduce((sum, a) => sum + (a.distanceM ?? 0), 0);
  const durationSec = cardio.reduce((sum, a) => sum + (a.durationSec ?? 0), 0);
  const streakDays = streak(
    opts.sessions,
    opts.freezeUsedDates ? { freezeUsedDates: opts.freezeUsedDates } : {},
  );
  const expected = Math.max(
    1,
    Math.round((opts.performance.sessions28d || recent.length) > 0 ? 12 : 8),
  );
  const consistencyScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(((opts.performance.sessions28d + recent.length) / (expected * 2)) * 100),
    ),
  );

  return {
    userId: opts.userId,
    sessionCount28d: opts.performance.sessions28d,
    sessionCountTotal: opts.sessions.length,
    streakDays,
    prCount: opts.performance.prCount ?? 0,
    preferredSports: preferredSportsFromActivities(opts.activities),
    activityCount28d: recent.length,
    cardioVolume28d: { distanceM, durationSec },
    consistencyScore,
    proofSummary: proofSummaryOf(opts.activities),
    challengeCount: opts.challenges?.length ?? 0,
    followerCount: opts.graph?.followerCount ?? 0,
    followingCount: opts.graph?.followingCount ?? 0,
  };
}

export function athleteProfileVisibleToViewer(opts: {
  viewerId: string;
  authorId: string;
  privacy: SocialPrivacy;
  viewerFollowsAuthor: boolean;
  authorFollowsViewer: boolean;
  sameClub: boolean;
  blockedEitherWay: boolean;
  muted: boolean;
}): boolean {
  if (opts.blockedEitherWay) return false;
  if (opts.muted && opts.viewerId !== opts.authorId) return false;
  if (
    !canOpenProfile({
      viewerId: opts.viewerId,
      authorId: opts.authorId,
      privacy: opts.privacy,
      viewerFollowsAuthor: opts.viewerFollowsAuthor,
      authorFollowsViewer: opts.authorFollowsViewer,
      sameClub: opts.sameClub,
      blockedEitherWay: opts.blockedEitherWay,
    })
  ) {
    return false;
  }
  if (opts.privacy.workouts === "friends" && opts.viewerId !== opts.authorId) {
    return isFriendsRelation({
      viewerFollowsAuthor: opts.viewerFollowsAuthor,
      authorFollowsViewer: opts.authorFollowsViewer,
      sameClub: opts.sameClub,
    });
  }
  return true;
}

/** Public payload never includes nutrition, weight, or photos. */
export function publicAthletePayload(profile: AthleteProfile): AthleteProfile {
  return { ...profile };
}
