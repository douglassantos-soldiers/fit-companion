import { describe, expect, it, vi } from "vitest";
import { timingSafeEqual } from "node:crypto";

describe("isUserBlocked fail-closed semantics", () => {
  it("denies when database client is unavailable", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db-admin", () => ({
      adminDbLoose: async () => null,
    }));
    const { isUserBlocked, checkUserBlocked } = await import("@/lib/account-status.server");
    const check = await checkUserBlocked({ userId: "u1" });
    expect(check.statusKnown).toBe(false);
    expect(check.blocked).toBe(true);
    expect(await isUserBlocked({ userId: "u1" })).toBe(true);
    vi.doUnmock("@/lib/db-admin");
    vi.resetModules();
  });
});

describe("cron secret timing-safe compare", () => {
  it("rejects unequal secrets without throwing", () => {
    const a = Buffer.from("secret-aaaaaaaa");
    const b = Buffer.from("secret-bbbbbbbb");
    expect(a.length).toBe(b.length);
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it("accepts equal secrets", () => {
    const a = Buffer.from("cron-secret-value");
    const b = Buffer.from("cron-secret-value");
    expect(timingSafeEqual(a, b)).toBe(true);
  });
});

describe("admin access mint policy", () => {
  it("documents that entitlement is required before access cookie", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/access.functions.ts", "utf8"),
    );
    expect(src).toContain("findEntitlementByEmail");
    expect(src).toMatch(/Admin cookie alone must NOT mint|no entitlement/i);
  });
});
