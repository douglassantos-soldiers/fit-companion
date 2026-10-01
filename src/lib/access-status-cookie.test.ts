import { describe, expect, it } from "vitest";
import {
  ACCESS_STATUS_COOKIE_TTL_MS,
  accountStatusStampFromCheck,
  decodeAccessToken,
  encodeAccessToken,
  readFreshAccessAccountStatus,
} from "@/lib/access-session.server";

describe("access cookie account status stamp", () => {
  it("round-trips status fields through encode/decode", () => {
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-status-stamp";
    process.env["ADMIN_SESSION_SECRET"] = "test-admin-secret-status-stamp";
    process.env["NODE_ENV"] = "test";
    const stamp = accountStatusStampFromCheck({ blocked: false, statusKnown: true });
    const token = encodeAccessToken({
      email: "a@soldiers.com",
      tier: "base",
      userId: "user-aaaaaaaa",
      ...stamp,
    });
    const decoded = decodeAccessToken(token);
    expect(decoded?.accountBlocked).toBe(false);
    expect(decoded?.statusKnown).toBe(true);
    expect(decoded?.statusCheckedAt).toBe(stamp.statusCheckedAt);
  });

  it("readFreshAccessAccountStatus trusts stamp within TTL", () => {
    const now = Date.parse("2026-10-01T12:00:00.000Z");
    const stamp = accountStatusStampFromCheck({
      blocked: false,
      statusKnown: true,
      nowMs: now - 60_000,
    });
    const fresh = readFreshAccessAccountStatus(stamp, now, ACCESS_STATUS_COOKIE_TTL_MS);
    expect(fresh).toEqual(stamp);
  });

  it("readFreshAccessAccountStatus rejects stale or blocked-unknown stamps", () => {
    const now = Date.parse("2026-10-01T12:00:00.000Z");
    const stale = accountStatusStampFromCheck({
      blocked: false,
      statusKnown: true,
      nowMs: now - ACCESS_STATUS_COOKIE_TTL_MS - 1,
    });
    expect(readFreshAccessAccountStatus(stale, now)).toBeNull();

    expect(
      readFreshAccessAccountStatus(
        { accountBlocked: false, statusKnown: true },
        now,
      ),
    ).toBeNull();
  });

  it("fresh blocked stamp denies without needing DB", () => {
    const now = Date.now();
    const stamp = accountStatusStampFromCheck({
      blocked: true,
      statusKnown: true,
      nowMs: now,
    });
    const fresh = readFreshAccessAccountStatus(stamp, now);
    expect(fresh?.accountBlocked).toBe(true);
    expect(fresh?.statusKnown).toBe(true);
  });
});
