import { describe, expect, it } from "vitest";
import {
  parseAccessEmail,
  parseAccessNext,
  resolveAccessUiState,
} from "./access-funnel";

describe("parseAccessNext", () => {
  it("accepts only safe paths", () => {
    expect(parseAccessNext("/")).toBe("/");
    expect(parseAccessNext("/onboarding")).toBe("/onboarding");
    expect(parseAccessNext("/treino")).toBeUndefined();
  });
});

describe("parseAccessEmail", () => {
  it("normalizes email", () => {
    expect(parseAccessEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
    expect(parseAccessEmail("nope")).toBeUndefined();
  });
});

describe("resolveAccessUiState", () => {
  it("verifying until checked", () => {
    expect(
      resolveAccessUiState({
        checked: false,
        tokenError: false,
        redeemedEmail: null,
        hasAuthUser: false,
        denyReason: null,
      }),
    ).toBe("verifying");
  });

  it("need_auth after redeem without session", () => {
    expect(
      resolveAccessUiState({
        checked: true,
        tokenError: false,
        redeemedEmail: "a@b.com",
        hasAuthUser: false,
        denyReason: null,
      }),
    ).toBe("need_auth");
  });

  it("maps deny reasons", () => {
    expect(
      resolveAccessUiState({
        checked: true,
        tokenError: false,
        redeemedEmail: null,
        hasAuthUser: true,
        denyReason: "stale_purchase",
      }),
    ).toBe("denied_stale");
    expect(
      resolveAccessUiState({
        checked: true,
        tokenError: false,
        redeemedEmail: null,
        hasAuthUser: true,
        denyReason: "not_configured",
      }),
    ).toBe("denied_config");
  });
});
