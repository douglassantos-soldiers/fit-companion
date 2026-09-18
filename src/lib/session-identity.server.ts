/**
 * Trusted identity resolution for server fns.
 * Never trust client-supplied userId; resolve via devices + optional access cookie.
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

/** Resolve user for a registered device. Creates anonymous user only if device is new. */
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
    const user = await resolveOrCreateUserByEmail(session.email);
    if (!user) return null;

    const db = await adminDbLoose();
    if (db) {
      const { data: device } = await db
        .from("devices")
        .select("user_id")
        .eq("device_id", deviceId)
        .maybeSingle();

      // Device already owned by another email user → reject hijack
      if (device?.user_id && device.user_id !== user.id) {
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
        userId: user.id,
        allowReassignFromAnonymous: true,
      });
    }

    return {
      userId: user.id,
      deviceId,
      email: session.email,
      fromAccessCookie: true,
    };
  }

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
