/**
 * Trusted identity resolution for server fns.
 * Session cookie is authoritative for userId when present.
 * Never trust client-supplied userId.
 */
import { assertSecurityConfiguration, readAppAccessSession } from "@/lib/access-session.server";
import { adminDbLoose } from "@/lib/db-admin";
import {
  ensureUserForDevice,
  getUserIdForDevice,
  resolveOrCreateUserByEmail,
} from "@/lib/identity";

export type TrustedIdentity = {
  userId: string;
  deviceId: string;
  email: string | null;
  fromAccessCookie: boolean;
};

/**
 * Resolve user for a device channel.
 * - With access cookie: userId from session (email → public.users); device attached as canal.
 * - Without cookie: anonymous user via device (local-first boot / pull only).
 * - requireAccess: refuse if no valid cookie.
 * - requireAccessIfLinked: if device user already has email, require cookie (sensitive reads).
 */
export async function resolveTrustedIdentity(opts: {
  deviceId: string;
  /** If true, require a valid access cookie (for sensitive writes). */
  requireAccess?: boolean;
  /** If true, require cookie when the device is already linked to an email user. */
  requireAccessIfLinked?: boolean;
}): Promise<TrustedIdentity | null> {
  try {
    assertSecurityConfiguration();
  } catch {
    if (process.env["NODE_ENV"] === "production") return null;
    // Dev without secrets: still allow identity resolution for local boot
  }

  const deviceId = String(opts.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) return null;

  const session = readAppAccessSession();
  if (opts.requireAccess && !session) return null;

  if (opts.requireAccessIfLinked && !session && !opts.requireAccess) {
    const existingUserId = await getUserIdForDevice(deviceId);
    if (existingUserId) {
      const db = await adminDbLoose();
      if (db) {
        const { data: u } = await db
          .from("users")
          .select("email")
          .eq("id", existingUserId)
          .maybeSingle();
        if (u?.email) return null;
      }
    }
  }

  if (session?.email) {
    // Prefer cookie.userId when present and valid; else resolve by email
    let userId = session.userId && session.userId.length >= 8 ? session.userId : null;
    let email = session.email;

    if (!userId) {
      const user = await resolveOrCreateUserByEmail(session.email);
      if (!user) return null;
      userId = user.id;
      email = user.email ?? session.email;
    } else {
      // Verify cookie userId still matches email user (prevent stale cookie spoof)
      const user = await resolveOrCreateUserByEmail(session.email);
      if (user && user.id !== userId) {
        userId = user.id;
      }
      email = user?.email ?? session.email;
    }

    const db = await adminDbLoose();
    if (db) {
      const { data: device } = await db
        .from("devices")
        .select("user_id")
        .eq("device_id", deviceId)
        .maybeSingle();

      if (device?.user_id && device.user_id !== userId) {
        const { data: owner } = await db
          .from("users")
          .select("email")
          .eq("id", device.user_id)
          .maybeSingle();
        const ownerEmail = (owner?.email as string | null)?.toLowerCase() ?? null;
        if (ownerEmail && ownerEmail !== session.email.toLowerCase()) {
          return null;
        }
      }

      const { attachDeviceSafe } = await import("@/lib/identity");
      await attachDeviceSafe({
        deviceId,
        userId,
        allowReassignFromAnonymous: true,
      });
    }

    try {
      const { isUserBlocked } = await import("@/lib/account-status.server");
      if (await isUserBlocked({ userId, email })) return null;
    } catch (e) {
      console.warn("trusted identity status check failed", e);
    }

    return {
      userId,
      deviceId,
      email,
      fromAccessCookie: true,
    };
  }

  if (opts.requireAccess) return null;

  const user = await ensureUserForDevice(deviceId);
  if (!user) return null;
  try {
    const { isUserBlocked } = await import("@/lib/account-status.server");
    if (await isUserBlocked({ userId: user.id, email: user.email })) return null;
  } catch (e) {
    console.warn("trusted identity status check failed", e);
  }
  return {
    userId: user.id,
    deviceId,
    email: user.email,
    fromAccessCookie: false,
  };
}

/** Resolve userId only from device registry (ignore client claim). */
export async function resolveUserIdFromDevice(deviceId: string): Promise<string | null> {
  const id = String(deviceId ?? "").trim();
  if (!id) return null;
  return getUserIdForDevice(id);
}

/** Domain upsert conflict targets after user-owned migration. */
export const USER_OWNED_CONFLICT = {
  profile: "user_id",
  appState: "user_id",
  session: "user_id,client_id",
  weight: "user_id,date",
  dailyMetrics: "user_id,date",
  supplementLogs: "user_id,date",
  mealEntries: "user_id,client_id",
} as const;
