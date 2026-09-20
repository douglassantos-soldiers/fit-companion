import { describe, expect, it } from "vitest";
import {
  ACCESS_PURCHASE_WINDOW_DAYS,
  accessCookieExpSec,
  accessDaysRemaining,
  accessExpiresAtMs,
  accessUrgencyLevel,
  daysSincePaid,
  isPurchaseWithinWindow,
  latestPaidAt,
} from "@/lib/access-window";

describe("40-day purchase access window", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse("2026-09-19T12:00:00.000Z");

  it("uses a 40-day window", () => {
    expect(ACCESS_PURCHASE_WINDOW_DAYS).toBe(40);
  });

  it("grants when last paid order is 10 days ago", () => {
    const paid = new Date(now - 10 * day).toISOString();
    expect(isPurchaseWithinWindow(paid, now)).toBe(true);
  });

  it("grants on the 40th day (inclusive)", () => {
    const paid = new Date(now - 40 * day).toISOString();
    expect(isPurchaseWithinWindow(paid, now)).toBe(true);
  });

  it("denies when last paid order is 41 days ago", () => {
    const paid = new Date(now - 41 * day).toISOString();
    expect(isPurchaseWithinWindow(paid, now)).toBe(false);
  });

  it("denies missing or invalid dates", () => {
    expect(isPurchaseWithinWindow(null, now)).toBe(false);
    expect(isPurchaseWithinWindow(undefined, now)).toBe(false);
    expect(isPurchaseWithinWindow("not-a-date", now)).toBe(false);
  });

  it("expiry is lastPaidAt + 40 days", () => {
    const paid = "2026-08-10T12:00:00.000Z";
    expect(accessExpiresAtMs(paid, now)).toBe(Date.parse(paid) + 40 * day);
  });

  it("cookie exp does not outlive the purchase window", () => {
    const paid = new Date(now - 39 * day).toISOString();
    const exp = accessCookieExpSec(paid, now);
    const remainingDays = (exp * 1000 - now) / day;
    expect(remainingDays).toBeGreaterThan(0);
    expect(remainingDays).toBeLessThanOrEqual(2);
  });

  it("picks the latest paid timestamp from a list", () => {
    expect(
      latestPaidAt([
        { created_at: "2026-01-01T00:00:00.000Z" },
        { processed_at: "2026-09-01T00:00:00.000Z", created_at: "2026-08-01T00:00:00.000Z" },
        { processed_at: "2026-07-01T00:00:00.000Z" },
      ]),
    ).toBe("2026-09-01T00:00:00.000Z");
  });

  it("legacy entitlement without last_order_at does not grant", () => {
    expect(isPurchaseWithinWindow(null, now)).toBe(false);
  });

  it("counts remaining days and urgency bands", () => {
    const expires = new Date(now + 2.5 * day).toISOString();
    expect(accessDaysRemaining(expires, now)).toBe(3);
    expect(accessUrgencyLevel(7)).toBe("d7");
    expect(accessUrgencyLevel(3)).toBe("d3");
    expect(accessUrgencyLevel(1)).toBe("d1");
    expect(accessUrgencyLevel(12)).toBeNull();
    expect(daysSincePaid(new Date(now - 10 * day).toISOString(), now)).toBe(10);
  });
});
