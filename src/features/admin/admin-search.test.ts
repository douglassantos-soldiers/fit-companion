import { describe, expect, it } from "vitest";
import { buildAdminSearch, parseAdminSearch, parseAdminTab } from "./admin-search";

describe("parseAdminTab", () => {
  it("allowlists known tabs", () => {
    expect(parseAdminTab("usuarios")).toBe("usuarios");
    expect(parseAdminTab("hack")).toBeUndefined();
  });
});

describe("parseAdminSearch", () => {
  it("keeps only defined keys", () => {
    expect(parseAdminSearch({})).toEqual({});
    expect(parseAdminSearch({ tab: "sistema", email: " A@B.COM " })).toEqual({
      tab: "sistema",
      email: "a@b.com",
    });
  });
});

describe("buildAdminSearch", () => {
  it("omits empty email", () => {
    expect(buildAdminSearch({ tab: "dashboard", email: "" })).toEqual({ tab: "dashboard" });
  });
});
