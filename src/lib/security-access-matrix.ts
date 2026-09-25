/**
 * Access-class matrix for AuthZ (pre-AI).
 * device_id is never an authority — ownership is always userId / membership.
 */
import type { AccessClass, AppRole, TrustedIdentity } from "@/lib/session-identity.server";

export type { AccessClass };

export const ACCESS_CLASS_MATRIX = {
  PUBLIC: {
    description: "Public feed/catalog; no PII; no writes from client to private rows",
    allowedRoles: ["anonymous", "user", "admin", "editor", "support", "analyst"] as const,
    requiresOwnership: false,
    requiresAccessCookie: false,
  },
  USER_PRIVATE: {
    description: "Training, nutrition, recovery, coach memory — owner only",
    allowedRoles: ["user", "admin", "editor", "support"] as const,
    requiresOwnership: true,
    requiresAccessCookie: true,
  },
  SOCIAL: {
    description: "Clubs, challenges, graph — membership by user_id",
    allowedRoles: ["user", "admin", "editor", "support"] as const,
    requiresOwnership: false,
    requiresAccessCookie: true,
  },
  COMMERCE: {
    description: "Entitlements/orders — server-side only; never trust client claims",
    allowedRoles: ["user", "admin"] as const,
    requiresOwnership: true,
    requiresAccessCookie: true,
  },
  ADMIN: {
    description: "CMS, grants, moderation — requireAdminSession",
    allowedRoles: ["admin", "editor", "support", "analyst"] as const,
    requiresOwnership: false,
    requiresAccessCookie: false,
  },
  SYSTEM: {
    description: "service_role / webhooks / cron — never client",
    allowedRoles: [] as const,
    requiresOwnership: false,
    requiresAccessCookie: false,
  },
  ANALYTICS: {
    description: "Events/impressions — write via server; read admin analyst",
    allowedRoles: ["admin", "analyst"] as const,
    requiresOwnership: false,
    requiresAccessCookie: false,
  },
} as const satisfies Record<
  AccessClass,
  {
    description: string;
    allowedRoles: readonly AppRole[];
    requiresOwnership: boolean;
    requiresAccessCookie: boolean;
  }
>;

export type ResourceRef = {
  userId?: string | null;
  clubId?: string | null;
  challengeId?: string | null;
};

/**
 * Central access check for Agents/Tools/server fns.
 * SYSTEM always denied for client identities.
 */
export function assertResourceAccess(
  identity: TrustedIdentity | null,
  accessClass: AccessClass,
  resource?: ResourceRef,
): boolean {
  if (accessClass === "SYSTEM") return false;
  if (accessClass === "PUBLIC") return true;

  if (!identity) return false;

  const meta = ACCESS_CLASS_MATRIX[accessClass];

  if (meta.requiresAccessCookie && !identity.fromAccessCookie) return false;

  if (accessClass === "ADMIN") {
    return (
      identity.role === "admin" ||
      identity.role === "editor" ||
      identity.role === "support" ||
      identity.role === "analyst"
    );
  }

  if (accessClass === "ANALYTICS") {
    return identity.role === "admin" || identity.role === "analyst";
  }

  if (identity.role === "anonymous") return false;

  if (!(meta.allowedRoles as readonly string[]).includes(identity.role)) {
    return false;
  }

  if (meta.requiresOwnership) {
    const owner = resource?.userId;
    if (!owner || owner !== identity.userId) return false;
  }

  if (resource?.clubId && identity.clubId && resource.clubId !== identity.clubId) {
    return false;
  }

  return true;
}

/** Deny cross-user private access (User A → User B). */
export function denyCrossUserPrivate(
  actor: TrustedIdentity,
  targetUserId: string | null | undefined,
): boolean {
  if (!targetUserId) return false;
  return assertResourceAccess(actor, "USER_PRIVATE", { userId: targetUserId });
}
