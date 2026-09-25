/**
 * FASE 2 — Identity AuthZ matrix / IDOR unit tests (no live DB).
 */
import { describe, expect, it } from "vitest";
import {
  assertResourceAccess,
  denyCrossUserPrivate,
  ACCESS_CLASS_MATRIX,
} from "@/lib/security-access-matrix";
import type { TrustedIdentity } from "@/lib/session-identity.server";
import { toTrustedUserId } from "@/lib/session-identity.server";
import { asTrustedUserId } from "@/ai/contracts/trusted-user-id";
import { auditFromIdentity } from "@/ai/governance";
import {
  deriveAccessSessionId,
  encodeAccessToken,
  encodeAdminToken,
  decodeAccessToken,
} from "@/lib/access-session.server";
import {
  assertClubMembershipByUser,
  assertChallengeOwnershipByUser,
  assertSameUser,
} from "@/lib/security-authz";

function identity(
  partial: Partial<TrustedIdentity> & Pick<TrustedIdentity, "userId" | "role">,
): TrustedIdentity {
  const base: TrustedIdentity = {
    deviceId: partial.deviceId ?? "device-aaaaaaaa",
    sessionId:
      partial.sessionId === undefined ? "sess-aaaaaaaaaaaaaaaaaaaaaaaaaaaa" : partial.sessionId,
    email: partial.email === undefined ? "a@soldiers.com" : partial.email,
    permissions: partial.permissions ?? ["read_own", "write_own"],
    tier: partial.tier === undefined ? "performance" : partial.tier,
    fromAccessCookie: partial.fromAccessCookie ?? true,
    userId: partial.userId,
    role: partial.role,
  };
  if (partial.clubId !== undefined) {
    return { ...base, clubId: partial.clubId };
  }
  return base;
}

describe("FASE2 access matrix", () => {
  it("defines all seven access classes", () => {
    expect(Object.keys(ACCESS_CLASS_MATRIX).sort()).toEqual(
      ["ADMIN", "ANALYTICS", "COMMERCE", "PUBLIC", "SOCIAL", "SYSTEM", "USER_PRIVATE"].sort(),
    );
  });

  it("PUBLIC is open; SYSTEM is never for client identities", () => {
    expect(assertResourceAccess(null, "PUBLIC")).toBe(true);
    expect(assertResourceAccess(identity({ userId: "user-a-aaaa", role: "user" }), "SYSTEM")).toBe(
      false,
    );
  });

  it("USER A cannot access USER B private resource", () => {
    const a = identity({ userId: "user-a-aaaaaa", role: "user" });
    expect(denyCrossUserPrivate(a, "user-b-bbbbbb")).toBe(false);
    expect(denyCrossUserPrivate(a, "user-a-aaaaaa")).toBe(true);
    expect(assertSameUser(a.userId, "user-b-bbbbbb")).toBe(false);
  });

  it("Device channel is not ownership — private requires matching userId", () => {
    const a = identity({
      userId: "user-a-aaaaaa",
      deviceId: "device-bbbbbbbb",
      role: "user",
    });
    // Spoofing another user's id fails even if device looks related
    expect(assertResourceAccess(a, "USER_PRIVATE", { userId: "user-b-bbbbbb" })).toBe(false);
  });

  it("Club A membership does not authorize Club B context", () => {
    const a = identity({
      userId: "user-a-aaaaaa",
      role: "user",
      clubId: "club-aaaa-1111",
    });
    expect(assertResourceAccess(a, "SOCIAL", { clubId: "club-bbbb-2222" })).toBe(false);
    expect(assertResourceAccess(a, "SOCIAL", { clubId: "club-aaaa-1111" })).toBe(true);
    expect(assertClubMembershipByUser(["user-a-aaaaaa"], "user-b-bbbbbb")).toBe(false);
  });

  it("Challenge A entry does not authorize Challenge B user", () => {
    expect(assertChallengeOwnershipByUser(["user-a-aaaaaa"], "user-b-bbbbbb")).toBe(false);
    expect(assertChallengeOwnershipByUser(["user-a-aaaaaa"], "user-a-aaaaaa")).toBe(true);
  });

  it("Anonymous cannot access USER_PRIVATE or SOCIAL", () => {
    const anon = identity({
      userId: "user-anon-aaaa",
      role: "anonymous",
      fromAccessCookie: false,
      email: null,
      tier: null,
      sessionId: null,
      permissions: ["local_boot"],
    });
    expect(assertResourceAccess(anon, "USER_PRIVATE", { userId: anon.userId })).toBe(false);
    expect(assertResourceAccess(anon, "SOCIAL")).toBe(false);
    expect(assertResourceAccess(anon, "PUBLIC")).toBe(true);
  });

  it("Admin role on identity can pass ADMIN class; normal user cannot", () => {
    const admin = identity({ userId: "user-admin-aa", role: "admin" });
    const user = identity({ userId: "user-normal-a", role: "user" });
    expect(assertResourceAccess(admin, "ADMIN")).toBe(true);
    expect(assertResourceAccess(user, "ADMIN")).toBe(false);
  });

  it("COMMERCE requires ownership + access cookie", () => {
    const a = identity({ userId: "user-a-aaaaaa", role: "user" });
    expect(assertResourceAccess(a, "COMMERCE", { userId: "user-a-aaaaaa" })).toBe(true);
    expect(assertResourceAccess(a, "COMMERCE", { userId: "user-b-bbbbbb" })).toBe(false);
    const anon = identity({
      userId: "user-anon-aaaa",
      role: "anonymous",
      fromAccessCookie: false,
    });
    expect(assertResourceAccess(anon, "COMMERCE", { userId: anon.userId })).toBe(false);
  });
});

describe("FASE2 session id + admin cookie isolation", () => {
  it("deriveAccessSessionId is stable and opaque", () => {
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-fase2-identity";
    process.env["NODE_ENV"] = "test";
    const token = encodeAccessToken({
      email: "a@soldiers.com",
      tier: "performance",
      userId: "user-aaaaaaaa",
    });
    expect(decodeAccessToken(token)?.email).toBe("a@soldiers.com");
    const sid = deriveAccessSessionId(token);
    expect(sid).toHaveLength(32);
    expect(sid).toBe(deriveAccessSessionId(token));
    expect(sid).not.toContain(token);
  });

  it("admin token alone is not an access session payload with userId", () => {
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-fase2-identity";
    process.env["NODE_ENV"] = "test";
    const admin = encodeAdminToken("admin@soldiers.com", "admin");
    // Admin token shape is not a valid access token
    expect(decodeAccessToken(admin)).toBeNull();
  });
});

describe("FASE2 AI TrustedUserId + governance", () => {
  it("toTrustedUserId / asTrustedUserId come from identity only", () => {
    const a = identity({ userId: "user-a-aaaaaa", role: "user" });
    const branded = asTrustedUserId(toTrustedUserId(a));
    expect(branded).toBe("user-a-aaaaaa");
    expect(() => asTrustedUserId("short")).toThrow(/invalid_trusted_user_id/);
  });

  it("auditFromIdentity stamps user_id and session from identity", () => {
    const a = identity({
      userId: "user-a-aaaaaa",
      role: "user",
      sessionId: "sess-bbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const rec = auditFromIdentity(a, "tool_call", "tool_read_profile");
    expect(rec.user_id).toBe("user-a-aaaaaa");
    expect(rec.session_id).toBe("sess-bbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(rec.kind).toBe("tool_call");
    expect(rec.role).toBe("user");
  });
});
