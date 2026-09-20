import { describe, expect, it } from "vitest";
import { orderHomeBlocks } from "@/lib/engine/home-layout";
import type { BehaviorProfile } from "@/lib/engine/behavior";
import { emptyState } from "@/lib/types";

const mid: BehaviorProfile = {
  consistency: 0.6,
  mealAdherence: 0.6,
  trainingAdherence: 0.6,
  sleepBehavior: 0.6,
  weekendPattern: 0.6,
  timeConstraintBehavior: 0.5,
  interventionResponse: {},
  confidence: 0.5,
};

describe("orderHomeBlocks", () => {
  it("does not include pinned hero/safety blocks", () => {
    const ids = orderHomeBlocks(emptyState, mid);
    expect(ids).not.toContain("livingHero");
    expect(ids).not.toContain("calibrate");
    expect(ids[0]).toBe("wow");
  });

  it("raises nutrition when meal adherence is low", () => {
    const ids = orderHomeBlocks(emptyState, { ...mid, mealAdherence: 0.2 });
    expect(ids.indexOf("nutritionProof")).toBeLessThan(ids.indexOf("wow"));
    expect(ids.indexOf("registerMeal")).toBeLessThan(ids.indexOf("wow"));
  });

  it("raises streak risk when training consistency is low", () => {
    const ids = orderHomeBlocks(emptyState, { ...mid, trainingAdherence: 0.2, consistency: 0.2 });
    expect(ids[0]).toBe("streakRisk");
  });
});
