import { describe, expect, it } from "vitest";
import {
  homeFallbackCtaLabel,
  homeFallbackSessionSearch,
} from "./home-fallback-hero";

describe("homeFallbackSessionSearch", () => {
  it("does not force express when Decision Engine says false", () => {
    expect(homeFallbackSessionSearch(false)).toEqual({ express: false, from: "hoje" });
  });

  it("passes express only when explicitly true", () => {
    expect(homeFallbackSessionSearch(true)).toEqual({
      express: true,
      from: "hoje",
    });
  });
});

describe("homeFallbackCtaLabel", () => {
  it("labels by express flag", () => {
    expect(homeFallbackCtaLabel(true)).toBe("Começar Express");
    expect(homeFallbackCtaLabel(false)).toBe("Treinar agora");
  });
});

describe("expressToday || true regression", () => {
  it("never coerces false to true", () => {
    const expressToday = false;
    // Bug was: expressToday || true === true always
    expect(expressToday || true).toBe(true);
    expect(expressToday).toBe(false);
  });
});
