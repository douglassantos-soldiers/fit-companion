/**
 * Client-side access-session cache helpers (session-scoped TTL).
 * Authorization remains server-side via checkAccessSession — this only avoids redundant client fetches.
 */

export const ACCESS_SESSION_STALE_MS = 90_000;

export type RevalidateOptions = {
  force?: boolean;
};

/** Skip network revalidation when cache is fresh and force is not set. */
export function shouldSkipRevalidate(
  validatedAt: number | null,
  now: number,
  staleMs: number = ACCESS_SESSION_STALE_MS,
  force: boolean = false,
): boolean {
  if (force) return false;
  if (validatedAt == null) return false;
  return now - validatedAt < staleMs;
}

/** True when a new auth user id must not reuse prior authorization. */
export function isAuthUserSwitch(
  previousAuthUserId: string | null,
  nextAuthUserId: string | null,
): boolean {
  if (!previousAuthUserId && !nextAuthUserId) return false;
  return previousAuthUserId !== nextAuthUserId;
}
