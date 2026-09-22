import { describe, expect, it } from "vitest";
import { mergeFavoriteFoodIds } from "@/lib/nutrition/favorite-foods-merge";

describe("mergeFavoriteFoodIds", () => {
  it("preserves remote when local is empty array", () => {
    expect(mergeFavoriteFoodIds([], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("unions local and remote", () => {
    expect(mergeFavoriteFoodIds(["b", "c"], ["a", "b"]).sort()).toEqual(["a", "b", "c"]);
  });
});
