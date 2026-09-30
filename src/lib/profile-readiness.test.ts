import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/types";
import {
  enrichmentPriority,
  isActivationReady,
  isNutritionReady,
  isOnboardingFullyComplete,
  isRecoveryReady,
  needsProfileEnrichment,
} from "@/lib/profile-readiness";

function base(partial: Partial<Profile> = {}): Profile {
  return {
    name: "Teste",
    goal: "massa",
    level: "iniciante",
    daysPerWeek: 3,
    age: 0,
    heightCm: 0,
    weightKg: 0,
    equipment: "academia",
    restrictions: [],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("profile-readiness", () => {
  it("activationReady requires valid body", () => {
    expect(isActivationReady(base())).toBe(false);
    expect(isActivationReady(base({ age: 25, heightCm: 175, weightKg: 80 }))).toBe(true);
  });

  it("nutritionReady when nutritionProfile set", () => {
    expect(isNutritionReady(base())).toBe(false);
    expect(
      isNutritionReady(
        base({
          nutritionProfile: { foodPreferences: [], foodRestrictions: [] },
        }),
      ),
    ).toBe(true);
  });

  it("onboardingFullyComplete needs body + nutrition", () => {
    const body = base({ age: 25, heightCm: 175, weightKg: 80 });
    expect(isOnboardingFullyComplete(body)).toBe(false);
    expect(
      isOnboardingFullyComplete({
        ...body,
        nutritionProfile: { foodPreferences: [], foodRestrictions: ["Lactose"] },
      }),
    ).toBe(true);
  });

  it("recoveryReady is sleep + blocker", () => {
    expect(isRecoveryReady(base())).toBe(false);
    expect(
      isRecoveryReady(base({ typicalSleepHours: 7, primaryBlocker: "consistencia" })),
    ).toBe(true);
  });

  it("enrichmentPriority prefers body then nutrition then recovery", () => {
    expect(enrichmentPriority(base())).toBe("body");
    expect(
      enrichmentPriority(base({ age: 25, heightCm: 175, weightKg: 80 })),
    ).toBe("nutrition");
    expect(
      enrichmentPriority(
        base({
          age: 25,
          heightCm: 175,
          weightKg: 80,
          nutritionProfile: { foodPreferences: [], foodRestrictions: [] },
        }),
      ),
    ).toBe("recovery");
  });

  it("needsProfileEnrichment for incomplete recovery", () => {
    expect(
      needsProfileEnrichment(
        base({
          age: 25,
          heightCm: 175,
          weightKg: 80,
          nutritionProfile: { foodPreferences: [], foodRestrictions: [] },
          onboardingComplete: true,
        }),
      ),
    ).toBe(true);
  });
});
