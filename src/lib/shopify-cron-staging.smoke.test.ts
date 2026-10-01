import { describe, expect, it } from "vitest";
import { createHmac, timingSafeEqual } from "node:crypto";
import { verifyShopifyHmacAsync } from "@/lib/shopify.server";

function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Mirrors /api/cron/daily-pushes bearer gate. */
function authorizeCron(header: string | null, secret: string): boolean {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || !token) return false;
  return timingSafeEqualString(token, secret);
}

describe("operator shopify/cron staging smoke (unit)", () => {
  it("accepts valid Shopify HMAC and rejects invalid", async () => {
    const secret = "staging-smoke-secret";
    const body = JSON.stringify({ id: 1, email: "a@b.c" });
    const hmac = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    await expect(verifyShopifyHmacAsync(body, hmac, secret)).resolves.toBe(true);
    await expect(verifyShopifyHmacAsync(body, "nope", secret)).resolves.toBe(false);
  });

  it("cron bearer gate accepts matching secret and rejects missing/wrong", () => {
    const secret = "cron-smoke-secret";
    expect(authorizeCron(`Bearer ${secret}`, secret)).toBe(true);
    expect(authorizeCron(null, secret)).toBe(false);
    expect(authorizeCron("Bearer wrong", secret)).toBe(false);
    expect(authorizeCron(`Bearer ${secret}`, "")).toBe(false);
  });
});
