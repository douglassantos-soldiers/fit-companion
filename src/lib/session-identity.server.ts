/**
 * Trusted identity resolution for server fns.
 * Access cookie (`soldiers_access`) is authoritative for userId when present.
 * Admin cookie NEVER authenticates an app user here — use requireAdminSession.
 * Never trust client-supplied userId. device_id is canal/provenance only.
 */
import {
  assertSecurityConfiguration,
  deriveAccessSessionId,
  readAccessSession,
  readAccessSessionToken,
  readAdminSessionPayload,
  type AdminRole,
} from "@/lib/access-session.server";
import { adminDbLoose } from "@/lib/db-admin";
import {
  ensureUserForDevice,
  getUserIdForDevice,
  resolveOrCreateUserByEmail,
} from "@/lib/identity";

export type AppRole = "anonymous" | "user" | AdminRole;

export type AccessClass =
  "PUBLIC" | "USER_PRIVATE" | "SOCIAL" | "COMMERCE" | "ADMIN" | "SYSTEM" | "ANALYTICS";

export type TrustedIdentity = {
  userId: string;
  /** Canal / provenance — never an authorization authority. */
  deviceId: string;
  /** Opaque hash of access token; null for anonymous boot. */
  sessionId: string | null;
  email: string | null;
  role: AppRole;
  permissions: readonly string[];
  tier: "base" | "performance" | null;
  fromAccessCookie: boolean;
  /** Set only when opts.clubId was passed and membership validated. */
  clubId?: string | null;
};

const ANON_PERMISSIONS = ["local_boot"] as const;
const USER_BASE_PERMISSIONS = [
  "read_own",
  "write_own",
  "social_participate",
  "commerce_self",
] as const;
const USER_PERF_PERMISSIONS = [...USER_BASE_PERMISSIONS, "coach_ai", "wearables"] as const;

function permissionsFor(role: AppRole, tier: "base" | "performance" | null): readonly string[] {
  if (role === "anonymous") return ANON_PERMISSIONS;
  if (role === "admin") {
    return [
      "admin_all",
      "read_own",
      "write_own",
      "social_participate",
      "commerce_self",
      "coach_ai",
    ];
  }
  if (role === "editor" || role === "support") {
    return ["admin_cms", "read_own", "write_own", "social_participate"];
  }
  if (role === "analyst") {
    return ["admin_analytics", "read_own"];
  }
  return tier === "performance" ? USER_PERF_PERMISSIONS : USER_BASE_PERMISSIONS;
}

/**
 * Resolve app role: access session → user; optional admin cookie only upgrades
 * role metadata when the same email holds a valid access session.
 */
function resolveAppRole(
  fromAccess: boolean,
  accessEmail: string | null,
  tier: "base" | "performance" | null,
): { role: AppRole; tier: "base" | "performance" | null } {
  if (!fromAccess) {
    return { role: "anonymous", tier: null };
  }
  const admin = readAdminSessionPayload();
  if (admin && accessEmail && admin.email.toLowerCase() === accessEmail.toLowerCase()) {
    return { role: admin.role, tier: tier ?? "performance" };
  }
  return { role: "user", tier };
}

/** Branded helper for AI contracts — never invent from client body. */
export function toTrustedUserId(identity: TrustedIdentity): string {
  return identity.userId;
}

/**
 * Resolve user for a device channel.
 * - With access cookie: userId from session (email → public.users); device attached as canal.
 * - Without cookie: anonymous user via device (local-first boot / pull only).
 * - requireAccess: refuse if no valid access cookie (admin alone is insufficient).
 * - requireAccessIfLinked: if device user already has email, require cookie (sensitive reads).
 * - clubId: when set, validates membership by user_id and stamps identity.clubId.
 */
export async function resolveTrustedIdentity(opts: {
  deviceId: string;
  /** If true, require a valid access cookie (for sensitive writes). */
  requireAccess?: boolean;
  /** If true, require cookie when the device is already linked to an email user. */
  requireAccessIfLinked?: boolean;
  /** Optional club context — membership checked by user_id. */
  clubId?: string;
}): Promise<TrustedIdentity | null> {
  try {
    assertSecurityConfiguration();
  } catch {
    if (process.env["NODE_ENV"] === "production") return null;
    // Dev without secrets: still allow identity resolution for local boot
  }

  const deviceId = String(opts.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) return null;

  // Access cookie only — admin cookie must NOT authenticate app identity.
  const session = readAccessSession();
  const accessToken = readAccessSessionToken();
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
    let userId = session.userId && session.userId.length >= 8 ? session.userId : null;
    let email = session.email;
    const tier = session.tier === "performance" ? "performance" : "base";

    if (!userId) {
      const user = await resolveOrCreateUserByEmail(session.email);
      if (!user) return null;
      userId = user.id;
      email = user.email ?? session.email;
    } else {
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

    const { role, tier: resolvedTier } = resolveAppRole(true, email, tier);
    const identity: TrustedIdentity = {
      userId,
      deviceId,
      sessionId: deriveAccessSessionId(accessToken),
      email,
      role,
      permissions: permissionsFor(role, resolvedTier),
      tier: resolvedTier,
      fromAccessCookie: true,
    };

    if (opts.clubId) {
      const clubOk = await validateClubMembershipByUser(opts.clubId, userId, deviceId);
      if (!clubOk) return null;
      identity.clubId = opts.clubId;
    }

    return identity;
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

  const identity: TrustedIdentity = {
    userId: user.id,
    deviceId,
    sessionId: null,
    email: user.email,
    role: "anonymous",
    permissions: permissionsFor("anonymous", null),
    tier: null,
    fromAccessCookie: false,
  };

  if (opts.clubId) {
    // Anonymous must not enter club-scoped ops
    return null;
  }

  return identity;
}

async function validateClubMembershipByUser(
  clubId: string,
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const db = await adminDbLoose();
  if (!db) return false;
  const { data: byUser } = await db
    .from("club_members")
    .select("club_id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (byUser) return true;
  // Legacy rows may only have device_id
  const { data: byDevice } = await db
    .from("club_members")
    .select("club_id, user_id")
    .eq("club_id", clubId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!byDevice) return false;
  if (byDevice.user_id == null) {
    await db
      .from("club_members")
      .update({ user_id: userId })
      .eq("club_id", clubId)
      .eq("device_id", deviceId);
    return true;
  }
  return byDevice.user_id === userId;
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
