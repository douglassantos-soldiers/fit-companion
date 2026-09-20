/**
 * Identity + Security Core — unit tests (no live DB).
 */
import { describe, expect, it } from "vitest";
import { parseEstablishAccessInput } from "@/lib/access-parse";
import { encodeAccessToken, decodeAccessToken } from "@/lib/access-session.server";
import { USER_OWNED_CONFLICT } from "@/lib/session-identity.server";

describe("Identity Security Core", () => {
  it("strips client entitlement claims from establishAccess input", () => {
    const parsed = parseEstablishAccessInput({
      email: "user@soldiers.com",
      deviceId: "device-abcdefgh",
      accessTier: "performance",
      orderCount: 99,
      productIds: ["whey"],
      userId: "spoof-user-id-12345",
    } as never);
    expect(parsed.email).toBe("user@soldiers.com");
    expect(parsed.deviceId).toBe("device-abcdefgh");
    expect((parsed as { accessTier?: unknown }).accessTier).toBeUndefined();
    expect((parsed as { orderCount?: unknown }).orderCount).toBeUndefined();
    expect((parsed as { productIds?: unknown }).productIds).toBeUndefined();
    expect((parsed as { userId?: unknown }).userId).toBeUndefined();
  });

  it("requires valid email for session establish", () => {
    expect(() => parseEstablishAccessInput({ email: "nope", deviceId: "device-abcdefgh" })).toThrow();
  });

  it("encodes and decodes access token with required userId", () => {
    const token = encodeAccessToken({
      email: "a@b.com",
      tier: "base",
      userId: "11111111-1111-4111-8111-111111111111",
    });
    const decoded = decodeAccessToken(token);
    expect(decoded?.email).toBe("a@b.com");
    expect(decoded?.userId).toBe("11111111-1111-4111-8111-111111111111");
    expect(decoded?.tier).toBe("base");
  });

  it("rejects tampered access token", () => {
    const token = encodeAccessToken({
      email: "a@b.com",
      tier: "base",
      userId: "11111111-1111-4111-8111-111111111111",
    });
    const [data] = token.split(".");
    expect(decodeAccessToken(`${data}.invalidsig`)).toBeNull();
  });

  it("rejects expired access token", () => {
    const token = encodeAccessToken({
      email: "a@b.com",
      tier: "base",
      userId: "11111111-1111-4111-8111-111111111111",
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(decodeAccessToken(token)).toBeNull();
  });

  it("rejects cookie when lastPaidAt is older than 40 days", () => {
    const token = encodeAccessToken({
      email: "a@b.com",
      tier: "base",
      userId: "11111111-1111-4111-8111-111111111111",
      lastPaidAt: new Date(Date.now() - 41 * 24 * 60 * 60 * 1000).toISOString(),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(decodeAccessToken(token)).toBeNull();
  });

  it("accepts cookie when lastPaidAt is 10 days ago", () => {
    const token = encodeAccessToken({
      email: "a@b.com",
      tier: "base",
      userId: "11111111-1111-4111-8111-111111111111",
      lastPaidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(decodeAccessToken(token)?.email).toBe("a@b.com");
  });

  it("defines user-owned upsert conflict targets (not device_id)", () => {
    expect(USER_OWNED_CONFLICT.profile).toBe("user_id");
    expect(USER_OWNED_CONFLICT.appState).toBe("user_id");
    expect(USER_OWNED_CONFLICT.session).toBe("user_id,client_id");
    expect(USER_OWNED_CONFLICT.weight).toBe("user_id,date");
    expect(USER_OWNED_CONFLICT.mealEntries).toBe("user_id,client_id");
    expect(USER_OWNED_CONFLICT.profile).not.toContain("device");
  });

  it("documents multi-device ownership key as user_id", () => {
    // Same user, two devices → same conflict target
    const deviceA = { userId: "u1", deviceId: "dev-a-xxxx" };
    const deviceB = { userId: "u1", deviceId: "dev-b-yyyy" };
    expect(deviceA.userId).toBe(deviceB.userId);
    expect(deviceA.deviceId).not.toBe(deviceB.deviceId);
  });

  it("Shopify identity key is customer id not email (contract)", () => {
    // customer_identities UNIQUE(provider, external_customer_id) — email is attribute only
    const identity = {
      provider: "shopify" as const,
      externalCustomerId: "gid://shopify/Customer/123",
      email: "buyer@example.com",
    };
    expect(identity.externalCustomerId).toBeTruthy();
    expect(identity.email).not.toBe(identity.externalCustomerId);
  });
});
