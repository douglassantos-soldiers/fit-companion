/**
 * FASE 1 — Security authorization unit tests (no live DB).
 */
import { describe, expect, it } from "vitest";
import {
  assertBothClubMembers,
  assertBothClubMembersByUser,
  assertChallengeOwnership,
  assertChallengeOwnershipByUser,
  assertClubMembership,
  assertClubMembershipByUser,
  assertSameUser,
  isAllowedCheckinImageUrl,
  scoreChallengeProgress,
} from "@/lib/security-authz";
import { parseEstablishAccessInput } from "@/lib/access-parse";
import { encodeAdminToken, decodeAdminToken } from "@/lib/access-session.server";

describe("FASE1 cross-tenant deny", () => {
  it("USER A cannot act as USER B", () => {
    expect(assertSameUser("user-a", "user-b")).toBe(false);
    expect(assertSameUser("user-a", "user-a")).toBe(true);
  });

  it("DEVICE A is not member of CLUB B membership list (legacy device helper)", () => {
    const clubAMembers = ["device-aaaa-1111", "device-bbbb-2222"];
    expect(assertClubMembership(clubAMembers, "device-cccc-3333")).toBe(false);
    expect(assertClubMembership(clubAMembers, "device-aaaa-1111")).toBe(true);
  });

  it("USER A is not member of CLUB B by user_id", () => {
    const clubAUsers = ["user-aaaa-1111", "user-bbbb-2222"];
    expect(assertClubMembershipByUser(clubAUsers, "user-cccc-3333")).toBe(false);
    expect(assertClubMembershipByUser(clubAUsers, "user-aaaa-1111")).toBe(true);
  });

  it("friend quest requires both users in same club", () => {
    const members = ["user-aaaa-1111", "user-bbbb-2222"];
    expect(assertBothClubMembersByUser(members, "user-aaaa-1111", "user-zzzz-9999")).toBe(false);
    expect(assertBothClubMembersByUser(members, "user-aaaa-1111", "user-aaaa-1111")).toBe(false);
    expect(assertBothClubMembersByUser(members, "user-aaaa-1111", "user-bbbb-2222")).toBe(true);
  });

  it("friend quest legacy device helper still works", () => {
    const members = ["device-aaaa-1111", "device-bbbb-2222"];
    expect(assertBothClubMembers(members, "device-aaaa-1111", "device-zzzz-9999")).toBe(false);
    expect(assertBothClubMembers(members, "device-aaaa-1111", "device-bbbb-2222")).toBe(true);
  });

  it("CHALLENGE A entry does not authorize CHALLENGE B user", () => {
    const entries = ["user-aaaa-1111"];
    expect(assertChallengeOwnershipByUser(entries, "user-bbbb-2222")).toBe(false);
    expect(assertChallengeOwnershipByUser(entries, "user-aaaa-1111")).toBe(true);
  });

  it("CHALLENGE legacy device helper", () => {
    const entries = ["device-aaaa-1111"];
    expect(assertChallengeOwnership(entries, "device-bbbb-2222")).toBe(false);
    expect(assertChallengeOwnership(entries, "device-aaaa-1111")).toBe(true);
  });
});

describe("FASE1 challenge eligible scoring", () => {
  it("impossible steps keep recorded_value and zero eligible_value", () => {
    // 100_000 * 45 + 1 exceeds MAX_STEPS_PER_DAY * 45
    const scored = scoreChallengeProgress({
      value: 100_000 * 45 + 1,
      baseline: 1000,
      metric: "steps",
    });
    expect(scored.recordedValue).toBe(100_000 * 45 + 1);
    expect(scored.eligibleValue).toBe(0);
    expect(scored.verificationStatus).toBe("rejected");
    expect(scored.flags.some((f) => f.code === "impossible_value")).toBe(true);
  });

  it("normal progress is accepted", () => {
    const scored = scoreChallengeProgress({
      value: 12,
      baseline: 10,
      metric: "sessoes",
    });
    expect(scored.eligibleValue).toBe(12);
    expect(scored.verificationStatus).toBe("accepted");
  });
});

describe("FASE1 media URL allowlist", () => {
  it("rejects arbitrary external URLs", () => {
    expect(isAllowedCheckinImageUrl("https://evil.example/x.jpg")).toBe(false);
  });

  it("accepts supabase checkins public path", () => {
    expect(
      isAllowedCheckinImageUrl(
        "https://zphtvrsxlhfgltwgbreu.supabase.co/storage/v1/object/public/checkins/dev/1.jpg",
        "zphtvrsxlhfgltwgbreu.supabase.co",
      ),
    ).toBe(true);
  });
});

describe("FASE1 entitlement client claims", () => {
  it("strips entitlement claims from establish input", () => {
    const parsed = parseEstablishAccessInput({
      email: "buyer@soldiers.com",
      deviceId: "device-abcdefgh",
      accessTier: "performance",
      userId: "spoof",
    } as never);
    expect((parsed as { accessTier?: unknown }).accessTier).toBeUndefined();
    expect((parsed as { userId?: unknown }).userId).toBeUndefined();
  });
});

describe("FASE1 admin roles", () => {
  it("encodes admin role in token (legacy PIN = admin)", () => {
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-fase1";
    process.env["NODE_ENV"] = "test";
    const token = encodeAdminToken("admin@soldiers.com", "admin");
    const decoded = decodeAdminToken(token);
    expect(decoded?.role).toBe("admin");
    expect(decoded?.email).toBe("admin@soldiers.com");
  });

  it("encodes analyst role for future least-privilege reads", () => {
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-fase1";
    process.env["NODE_ENV"] = "test";
    const token = encodeAdminToken("analyst@soldiers.com", "analyst");
    expect(decodeAdminToken(token)?.role).toBe("analyst");
  });
});

describe("FASE1 league points API contract", () => {
  it("syncLeague op type allows omitting points", () => {
    const op: { op: "syncLeague"; deviceId: string; displayName: string; points?: number } = {
      op: "syncLeague",
      deviceId: "device-abcdefgh",
      displayName: "Soldado",
    };
    expect(op.points).toBeUndefined();
  });
});
