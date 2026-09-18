/**
 * Identity + access session contract tests (no DB / no server runtime).
 */
import { describe, expect, it } from "vitest";
import { parseEstablishAccessInput } from "@/lib/access-parse";
import * as identity from "@/lib/identity";

describe("parseEstablishAccessInput", () => {
  it("keeps only email + deviceId", () => {
    const parsed = parseEstablishAccessInput({
      email: " Buyer@Soldiers.COM ",
      deviceId: "device-uuid-abc",
      accessTier: "performance",
      orderCount: 99,
      productIds: ["whey-protein", "creatina"],
      shopifyCustomerId: "12345",
    });
    expect(parsed).toEqual({
      email: "buyer@soldiers.com",
      deviceId: "device-uuid-abc",
    });
    expect(parsed).not.toHaveProperty("accessTier");
    expect(parsed).not.toHaveProperty("productIds");
    expect(parsed).not.toHaveProperty("orderCount");
    expect(parsed).not.toHaveProperty("shopifyCustomerId");
  });

  it("rejects invalid email", () => {
    expect(() => parseEstablishAccessInput({ email: "nope", deviceId: "x" })).toThrow(/E-mail/i);
  });

  it("allows empty deviceId (trimmed string)", () => {
    const parsed = parseEstablishAccessInput({ email: "a@b.com" });
    expect(parsed.email).toBe("a@b.com");
    expect(parsed.deviceId).toBe("");
  });
});

describe("identity module exports", () => {
  it("exports core Identity Engine functions", () => {
    expect(typeof identity.resolveOrCreateUserByEmail).toBe("function");
    expect(typeof identity.attachDevice).toBe("function");
    expect(typeof identity.linkShopifyIdentity).toBe("function");
    expect(typeof identity.getUserIdForDevice).toBe("function");
    expect(typeof identity.ensureUserForDevice).toBe("function");
    expect(typeof identity.linkDeviceToShopifyUser).toBe("function");
  });
});
