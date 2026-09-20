/**
 * Profile-generated challenge templates (Fase 16). Stable catalog, not a builder.
 */
import { challengeById, type Challenge } from "@/data/challenges";

export const PROFILE_CHALLENGE_IDS = ["gen-iniciante-8", "gen-puxada-5", "gen-convide-3"] as const;
export type ProfileChallengeId = (typeof PROFILE_CHALLENGE_IDS)[number];

export function isProfileGeneratedChallenge(id: string): id is ProfileChallengeId {
  return (PROFILE_CHALLENGE_IDS as readonly string[]).includes(id);
}

export function suggestProfileChallenges(opts: {
  level?: string | null;
  sessionCount: number;
  hasClub: boolean;
  followingCount: number;
}): Challenge[] {
  const ids: ProfileChallengeId[] = [];
  if (opts.level === "iniciante" || opts.sessionCount < 8) ids.push("gen-iniciante-8");
  if (opts.level === "avancado" || opts.sessionCount >= 20) ids.push("gen-puxada-5");
  if (opts.hasClub || opts.followingCount > 0) ids.push("gen-convide-3");
  return ids.map((id) => challengeById(id)).filter((c): c is Challenge => Boolean(c));
}
