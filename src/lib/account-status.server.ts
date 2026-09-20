/**
 * User account status (block/suspend) — no health columns.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { isAccountBlocked, normalizeAccountStatus, type AccountStatus } from "@/lib/account-status";
import { ADMIN_ACTOR, writeAudit, lookupUserByEmail, type AdminUserLookup } from "@/lib/admin.server";

export async function loadAccountStatus(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<{ status: AccountStatus; statusUntil: string | null; statusReason: string | null } | null> {
  const db = await adminDbLoose();
  if (!db) return null;
  let row: { status?: unknown; status_until?: unknown; status_reason?: unknown } | null = null;
  if (opts.userId) {
    const { data } = await db
      .from("users")
      .select("status, status_until, status_reason")
      .eq("id", opts.userId)
      .maybeSingle();
    row = data;
  } else if (opts.email) {
    const { data } = await db
      .from("users")
      .select("status, status_until, status_reason")
      .ilike("email", opts.email.trim().toLowerCase())
      .maybeSingle();
    row = data;
  }
  if (!row) return null;
  return {
    status: normalizeAccountStatus(row.status as string | null),
    statusUntil: (row.status_until as string | null) ?? null,
    statusReason: (row.status_reason as string | null) ?? null,
  };
}

export async function isUserBlocked(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const row = await loadAccountStatus(opts);
  if (!row) return false;
  return isAccountBlocked({ status: row.status, statusUntil: row.statusUntil });
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

  const { data: user } = await db.from("users").select("id").ilike("email", email).maybeSingle();
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

  const action =
    status === "banned" ? "user_ban" : status === "suspended" ? "user_suspend" : "user_unsuspend";
  await writeAudit(action, { email, status, statusUntil: opts.statusUntil ?? null }, ADMIN_ACTOR);
  const lookup = await lookupUserByEmail(email);
  return { ok: true, lookup };
}
