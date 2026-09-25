/**
 * FASE 1 — pure helpers for authorization / challenge eligibility.
 * No DB; used by server + unit tests.
 */
import {
  validateChallengeProgress,
  type ChallengeProgressInput,
  type FraudFlag,
  type FraudValidationResult,
} from "@/lib/engine/anti-fraud";
import { applyFraudPolicy } from "@/lib/engine/anti-fraud-policy";

export type VerificationStatus = "accepted" | "rejected" | "flagged";

export type EligibleChallengeResult = {
  recordedValue: number;
  eligibleValue: number;
  verificationStatus: VerificationStatus;
  flags: FraudFlag[];
  pct: number | null;
};

/** Cross-tenant deny helpers (pure). */
export function assertSameUser(actorUserId: string, resourceUserId: string): boolean {
  return Boolean(actorUserId) && actorUserId === resourceUserId;
}

/** Preferred: membership / ownership by app user_id (device_id is not identity). */
export function assertClubMembershipByUser(memberUserIds: string[], userId: string): boolean {
  return Boolean(userId) && memberUserIds.includes(userId);
}

export function assertBothClubMembersByUser(
  memberUserIds: string[],
  userA: string,
  userB: string,
): boolean {
  if (!userA || !userB || userA === userB) return false;
  return memberUserIds.includes(userA) && memberUserIds.includes(userB);
}

export function assertChallengeOwnershipByUser(entryUserIds: string[], userId: string): boolean {
  return Boolean(userId) && entryUserIds.includes(userId);
}

/**
 * @deprecated Prefer assertClubMembershipByUser — device_id is not identity.
 * Kept for legacy rows during migration; do not use for new AuthZ.
 */
export function assertClubMembership(memberDeviceIds: string[], deviceId: string): boolean {
  return memberDeviceIds.includes(deviceId);
}

/**
 * @deprecated Prefer assertBothClubMembersByUser.
 */
export function assertBothClubMembers(
  memberDeviceIds: string[],
  deviceA: string,
  deviceB: string,
): boolean {
  if (!deviceA || !deviceB || deviceA === deviceB) return false;
  return memberDeviceIds.includes(deviceA) && memberDeviceIds.includes(deviceB);
}

/**
 * @deprecated Prefer assertChallengeOwnershipByUser.
 */
export function assertChallengeOwnership(entryDeviceIds: string[], deviceId: string): boolean {
  return entryDeviceIds.includes(deviceId);
}

/** Allowed public story / checkin image hosts (path must stay under checkins/). */
export function isAllowedCheckinImageUrl(imageUrl: string, publicSupabaseHost?: string): boolean {
  const u = String(imageUrl ?? "").trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const path = parsed.pathname;
    if (!path.includes("/storage/v1/object/public/checkins/") && !path.includes("/checkins/")) {
      return false;
    }
    if (publicSupabaseHost) {
      const host = parsed.hostname.toLowerCase();
      const expected = publicSupabaseHost
        .replace(/^https?:\/\//, "")
        .split("/")[0]!
        .toLowerCase();
      if (host !== expected && !host.endsWith(".supabase.co")) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Server-side challenge scoring: never trust client fraudFlags.
 * Impossible values keep recorded_value but eligible_value = 0.
 */
export function scoreChallengeProgress(
  input: ChallengeProgressInput & { pct?: number | null },
): EligibleChallengeResult {
  const recordedValue = Number(input.value);
  const result: FraudValidationResult = validateChallengeProgress({
    value: recordedValue,
    baseline: input.baseline,
    metric: input.metric,
    ...(input.personalTarget != null ? { personalTarget: input.personalTarget } : {}),
  });
  const policy = applyFraudPolicy(result);
  let verificationStatus: VerificationStatus = "accepted";
  let eligibleValue = recordedValue;
  if (policy.action === "block_input" || !result.ok) {
    verificationStatus = "rejected";
    eligibleValue = 0;
  } else if (policy.action === "warn" || result.flags.length > 0) {
    verificationStatus = "flagged";
    eligibleValue = recordedValue;
  }

  let pct: number | null = input.pct ?? null;
  if (pct == null && input.baseline > 0) {
    pct = ((eligibleValue - input.baseline) / Math.max(input.baseline, 1)) * 100;
  } else if (pct == null && input.personalTarget) {
    pct = (eligibleValue / Math.max(input.personalTarget, 1)) * 100;
  }
  if (verificationStatus === "rejected") pct = 0;

  return {
    recordedValue,
    eligibleValue,
    verificationStatus,
    flags: result.flags,
    pct,
  };
}

/** League points must be computed server-side — reject client-supplied points. */
export function rejectClientLeaguePoints(op: { points?: unknown }): number | null {
  if (op.points !== undefined) return null;
  return null;
}
