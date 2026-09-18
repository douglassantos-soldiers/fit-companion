/**
 * Trusted identity resolution for server fns.
 * Session cookie is authoritative for userId when present.
 * Never trust client-supplied userId.
 */
import { readAccessSession } from "@/lib/access-session.server";
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
 */
export async function resolveTrustedIdentity(opts: {
  deviceId: string;
  /** If true, require a valid access cookie (for sensitive writes). */
  requireAccess?: boolean;
}): Promise<TrustedIdentity | null> {
  const deviceId = String(opts.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) return null;

  const session = readAccessSession();
  if (opts.requireAccess && !session) return null;

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
