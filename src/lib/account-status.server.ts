/**
 * User account status (block/suspend) — no health columns.
 * Status checks fail closed when the database is unavailable.
 * In-process TTL cache cuts repeated users.status reads on every identity resolve.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { isAccountBlocked, normalizeAccountStatus, type AccountStatus } from "@/lib/account-status";
import { ADMIN_ACTOR, writeAudit, lookupUserByEmail, type AdminUserLookup } from "@/lib/admin.server";

export type BlockCheckResult = {
  /** True when the account is banned/suspended in-window. */
  blocked: boolean;
  /**
   * False when we could not load status (DB down). Callers with requireAccess
   * must deny — never treat unknown as allowed.
   */
  statusKnown: boolean;
};

/** In-process TTL for AuthZ status checks (seconds). */
export const ACCOUNT_STATUS_CACHE_TTL_MS = 60_000;

type StatusCacheEntry = { expiresAt: number; result: BlockCheckResult };

const statusCache = new Map<string, StatusCacheEntry>();

function cacheKeys(opts: { userId?: string | null; email?: string | null }): string[] {
  const keys: string[] = [];
  if (opts.userId) keys.push(`id:${opts.userId}`);
  const email = opts.email?.trim().toLowerCase();
  if (email) keys.push(`email:${email}`);
  return keys;
}

/** Drop cached status for a user (call after ban/suspend/unsuspend). */
export function invalidateAccountStatusCache(opts: {
  userId?: string | null;
  email?: string | null;
}): void {
  for (const key of cacheKeys(opts)) statusCache.delete(key);
}

/** Test helper — clears the entire in-process cache. */
export function clearAccountStatusCacheForTests(): void {
  statusCache.clear();
}

function readStatusCache(opts: {
  userId?: string | null;
  email?: string | null;
}): BlockCheckResult | null {
  const now = Date.now();
  for (const key of cacheKeys(opts)) {
    const hit = statusCache.get(key);
    if (!hit) continue;
    if (hit.expiresAt <= now) {
      statusCache.delete(key);
      continue;
    }
    return hit.result;
  }
  return null;
}

function writeStatusCache(
  opts: { userId?: string | null; email?: string | null },
  result: BlockCheckResult,
): void {
  const entry: StatusCacheEntry = {
    expiresAt: Date.now() + ACCOUNT_STATUS_CACHE_TTL_MS,
    result,
  };
  for (const key of cacheKeys(opts)) statusCache.set(key, entry);
}

export async function loadAccountStatus(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<{ status: AccountStatus; statusUntil: string | null; statusReason: string | null } | null> {
  const db = await adminDbLoose();
  if (!db) return null;
  let row: { status?: unknown; status_until?: unknown; status_reason?: unknown } | null = null;
  if (opts.userId) {
    const { data, error } = await db
      .from("users")
      .select("status, status_until, status_reason")
      .eq("id", opts.userId)
      .maybeSingle();
    if (error) throw new Error(`account_status_query:${error.code ?? "error"}`);
    row = data;
  } else if (opts.email) {
    const { data, error } = await db
      .from("users")
      .select("status, status_until, status_reason")
      .eq("email", opts.email.trim().toLowerCase())
      .maybeSingle();
    if (error) throw new Error(`account_status_query:${error.code ?? "error"}`);
    row = data;
  }
  if (!row) return null;
  return {
    status: normalizeAccountStatus(row.status as string | null),
    statusUntil: (row.status_until as string | null) ?? null,
    statusReason: (row.status_reason as string | null) ?? null,
  };
}

/**
 * Prefer `checkUserBlocked` for AuthZ. This wrapper remains for simple boolean site;
 * on DB failure it returns **true** (fail-closed) so callers that only check boolean deny access.
 */
export async function isUserBlocked(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const result = await checkUserBlocked(opts);
  if (!result.statusKnown) return true;
  return result.blocked;
}

export async function checkUserBlocked(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<BlockCheckResult> {
  const cached = readStatusCache(opts);
  if (cached) return cached;

  try {
    const db = await adminDbLoose();
    if (!db) {
      // Do not cache unknown/DB-down — retry next call.
      return { blocked: true, statusKnown: false };
    }
    void db;
    const row = await loadAccountStatus(opts);
    const result: BlockCheckResult = row
      ? {
          blocked: isAccountBlocked({ status: row.status, statusUntil: row.statusUntil }),
          statusKnown: true,
        }
      : {
          // No users row — not blocked, but status is known (absent).
          blocked: false,
          statusKnown: true,
        };
    writeStatusCache(opts, result);
    return result;
  } catch (e) {
    console.error("checkUserBlocked failed closed", e);
    return { blocked: true, statusKnown: false };
  }
}

export async function setUserAccountStatus(opts: {
  email: string;
  status: AccountStatus;
  statusUntil?: string | null;
  reason?: string | null;
}): Promise<{ ok: true; lookup: AdminUserLookup } | { ok: false; reason: string }> {
  const email = opts.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, reason: "invalid_email" };
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };

  const { data: user } = await db.from("users").select("id").eq("email", email).maybeSingle();
  if (!user?.id) return { ok: false, reason: "not_found" };

  const status = normalizeAccountStatus(opts.status);
  const { error } = await db
    .from("users")
    .update({
      status,
      status_until: status === "suspended" ? opts.statusUntil || null : null,
      status_reason: (opts.reason ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    console.error("users status update failed", error);
    return { ok: false, reason: "update_failed" };
  }

  invalidateAccountStatusCache({ userId: user.id, email });

  const action =
    status === "banned" ? "user_ban" : status === "suspended" ? "user_suspend" : "user_unsuspend";
  await writeAudit(action, { email, status, statusUntil: opts.statusUntil ?? null }, ADMIN_ACTOR);
  const lookup = await lookupUserByEmail(email);
  return { ok: true, lookup };
}
