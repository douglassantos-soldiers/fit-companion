import { describe, expect, it } from "vitest";
import {
  ACCESS_SESSION_STALE_MS,
  isAuthUserSwitch,
  shouldSkipRevalidate,
} from "@/lib/access-session-cache";

describe("access-session-cache", () => {
  it("skips revalidate when within stale window", () => {
    const validatedAt = 1_000_000;
    expect(shouldSkipRevalidate(validatedAt, validatedAt + 30_000, ACCESS_SESSION_STALE_MS, false)).toBe(
      true,
    );
  });

  it("does not skip when stale", () => {
    const validatedAt = 1_000_000;
    expect(
      shouldSkipRevalidate(validatedAt, validatedAt + ACCESS_SESSION_STALE_MS + 1, ACCESS_SESSION_STALE_MS, false),
    ).toBe(false);
  });

  it("never skips when force is true", () => {
    const validatedAt = 1_000_000;
    expect(shouldSkipRevalidate(validatedAt, validatedAt + 1, ACCESS_SESSION_STALE_MS, true)).toBe(false);
  });

  it("does not skip when never validated", () => {
    expect(shouldSkipRevalidate(null, Date.now(), ACCESS_SESSION_STALE_MS, false)).toBe(false);
  });

  it("detects auth user switch and logout/login edges", () => {
    expect(isAuthUserSwitch(null, null)).toBe(false);
    expect(isAuthUserSwitch("a", "a")).toBe(false);
    expect(isAuthUserSwitch("a", "b")).toBe(true);
    expect(isAuthUserSwitch("a", null)).toBe(true);
    expect(isAuthUserSwitch(null, "a")).toBe(true);
  });
});
