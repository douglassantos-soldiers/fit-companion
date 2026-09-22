import { describe, expect, it } from "vitest";
import { foodProvenanceLine, foodSourceLabel } from "@/lib/nutrition/food-source-label";

describe("foodProvenanceLine", () => {
  it("labels sources", () => {
    expect(foodSourceLabel("taco")).toContain("TACO");
    expect(foodSourceLabel("imported")).toContain("Open Food Facts");
    expect(foodSourceLabel("ai_estimate")).toContain("IA");
  });

  it("formats measured TACO", () => {
    expect(foodProvenanceLine({ source: "taco", confidence: 0.95, kind: "observed" })).toBe(
      "TACO (NEPA/UNICAMP) · 95% · medido",
    );
  });

  it("formats estimated OFF", () => {
    expect(foodProvenanceLine({ source: "imported", confidence: 0.6, kind: "estimated" })).toBe(
      "Open Food Facts · 60% · estimado",
    );
  });

  it("formats AI without kind", () => {
    expect(foodProvenanceLine({ source: "ai_estimate", confidence: 0.72 })).toBe(
      "Estimativa IA · 72%",
    );
  });
});
