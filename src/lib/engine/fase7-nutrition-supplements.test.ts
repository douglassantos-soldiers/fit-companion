/**
 * FASE 7 — Nutrition Intelligence + Supplement Intelligence tests.
 */
import { describe, expect, it } from "vitest";
import { matchLineItem, estimateRestock, primaryReorderProductId, primaryReorderUrl } from "@/data/shopify-product-map";
import { buildDailyMealPlan, dayNutritionTotalsFromState, mealProvenanceLabel, nutritionGoals } from "@/lib/engine/nutrition";
import { activeMealSlots, buildNutritionProfileFromFlags } from "@/lib/engine/nutrition-profile";
import {
  estimateInventoryFromConsumption,
  restockSoftMessage,
  mergeRestockWithConsumption,
} from "@/lib/engine/supplement-inventory";
import { emptyState, type AppState, type MealEntry, type Profile, type SupplementDoseLog } from "@/lib/types";

function baseProfile(over: Partial<Profile> = {}): Profile {
  return {
    name: "Test",
    goal: "massa",
    level: "intermediario",
    daysPerWeek: 4,
    age: 30,
    heightCm: 178,
    weightKg: 80,
    equipment: "academia",
    restrictions: [],
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("FASE 7 nutrition intelligence", () => {
  it("skips breakfast and redistributes across active slots", () => {
    const profile = baseProfile({
      skipBreakfast: true,
      nutritionProfile: buildNutritionProfileFromFlags({ skipBreakfast: true }),
    });
    expect(activeMealSlots(profile)).toEqual(["almoco", "lanche", "jantar"]);
    const goals = nutritionGoals(profile);
    expect(goals.mealsTarget).toBe(3);

    const plan = buildDailyMealPlan(profile, { ...emptyState, profile });
    expect(plan.redistributed).toBe(true);
    const cafe = plan.slots.find((s) => s.slot === "cafe");
    expect(cafe?.status).toBe("skipped");
    const active = plan.slots.filter((s) => s.status === "suggested");
    expect(active.length).toBe(3);
    expect(active.every((s) => (s.suggestedServings ?? 1) > 1)).toBe(true);
  });

  it("labels informed vs estimated meal provenance", () => {
    const informed: MealEntry = {
      id: "1",
      date: "2026-09-18",
      slot: "almoco",
      label: "Frango",
      proteinG: 40,
      kcal: 400,
      quality: "verde",
      sourceKind: "informed",
      confidence: 1,
    };
    const estimated: MealEntry = {
      ...informed,
      id: "2",
      sourceKind: "estimated",
      confidence: 0.72,
      aiMode: "photo",
    };
    const corrected: MealEntry = {
      ...estimated,
      id: "3",
      sourceKind: "informed",
      correctedFromAi: true,
    };
    expect(mealProvenanceLabel(informed)).toBe("Informado");
    expect(mealProvenanceLabel(estimated)).toBe("Estimativa IA (72%)");
    expect(mealProvenanceLabel(corrected)).toBe("Informado (corrigido)");
  });
});

describe("FASE 7 supplement inventory + Shopify map", () => {
  it("maps Shopify line items to product + package size", () => {
    const matched = matchLineItem({ title: "Creatina Monoidratada 300g", quantity: 1 });
    expect(matched?.productId).toBe("creatina");
    expect(matched?.servingsPerContainer).toBe(60);
  });

  it("purchase-only estimate has low confidence; doses deplete stock", () => {
    const purchases = [
      {
        productId: "creatina",
        quantity: 1,
        orderedAt: "2026-09-01T12:00:00.000Z",
        servingsPerContainer: 60,
        servingsPerDay: 1,
      },
    ];
    const doseLogs: SupplementDoseLog[] = Array.from({ length: 10 }, (_, i) => ({
      id: `d${i}`,
      productId: "creatina",
      dose: 1,
      unit: "serving" as const,
      frequency: "1x_day" as const,
      takenAt: `2026-09-${String(i + 2).padStart(2, "0")}T10:00:00.000Z`,
      source: "manual" as const,
    }));

    const purchaseOnly = estimateInventoryFromConsumption({
      purchases,
      doseLogs: [],
      now: new Date("2026-09-18T12:00:00.000Z"),
    });
    expect(purchaseOnly["creatina"]?.confidence).toBeLessThan(0.5);
    expect(purchaseOnly["creatina"]?.daysLeft).toBeGreaterThan(50);

    const withDoses = estimateInventoryFromConsumption({
      purchases,
      doseLogs,
      now: new Date("2026-09-18T12:00:00.000Z"),
    });
    expect(withDoses["creatina"]?.estimatedServingsLeft).toBe(50);
    expect(withDoses["creatina"]!.confidence!).toBeGreaterThan(purchaseOnly["creatina"]!.confidence!);
  });

  it("soft restock copy never says buy now", () => {
    const msg = restockSoftMessage({
      productId: "whey-protein",
      emptyAt: new Date().toISOString(),
      daysLeft: 5,
      quantity: 1,
      confidence: 0.6,
      kind: "estimate",
    });
    expect(msg.headline).toContain("estoque estimado");
    expect(msg.headline.toLowerCase()).not.toContain("compre");
    expect(msg.detail.toLowerCase()).toContain("confiança");
  });

  it("estimateRestock + merge with consumption keeps kind estimate", () => {
    const base = estimateRestock(
      ["whey-protein"],
      [{ title: "Whey Protein", quantity: 1 }],
      "2026-09-01T12:00:00.000Z",
    );
    expect(base["whey-protein"]).toBeTruthy();
    const doses: SupplementDoseLog[] = [
      {
        id: "1",
        productId: "whey-protein",
        dose: 1,
        unit: "serving",
        frequency: "1x_day",
        takenAt: "2026-09-10T12:00:00.000Z",
        source: "manual",
      },
    ];
    const merged = mergeRestockWithConsumption(base, doses, {}, new Date("2026-09-18T12:00:00.000Z"));
    expect(merged["whey-protein"]?.kind).toBe("estimate");
    expect(typeof merged["whey-protein"]?.confidence).toBe("number");
  });
});

describe("FASE 7 meal logging contract smoke", () => {
  it("keeps informed defaults on preset-like entries in state shape", () => {
    const meals: MealEntry[] = [
      {
        id: "m1",
        date: "2026-09-18",
        slot: "almoco",
        label: "Preset",
        proteinG: 35,
        kcal: 450,
        quality: "verde",
        presetId: "x",
        sourceKind: "informed",
        confidence: 1,
      },
    ];
    const state: AppState = { ...emptyState, meals };
    expect(state.meals[0]?.sourceKind).toBe("informed");
    expect(state.supplementDoseLogs).toEqual([]);
  });
});

describe("engine + whey feed the diary", () => {
  it("applies calorieDelta and proteinBias to goals", () => {
    const profile = baseProfile();
    const base = nutritionGoals(profile);
    const adapted = nutritionGoals(profile, null, { calorieDelta: -200, proteinBias: "up" });
    expect(adapted.kcal).toBe(Math.max(1400, base.kcal - 200));
    expect(adapted.proteinG).toBe(Math.round(base.proteinG * 1.05));
  });

  it("rebalanced distribution and training day bump lanche servings", () => {
    const profile = baseProfile();
    const rest = buildDailyMealPlan(profile, { ...emptyState, profile }, undefined, null, {
      mealDistribution: "default",
      trainingMode: "rest",
    });
    const train = buildDailyMealPlan(profile, { ...emptyState, profile }, undefined, null, {
      mealDistribution: "rebalanced",
      trainingMode: "full",
    });
    const restLanche = rest.slots.find((s) => s.slot === "lanche");
    const trainLanche = train.slots.find((s) => s.slot === "lanche");
    expect((trainLanche?.suggestedServings ?? 0) - (restLanche?.suggestedServings ?? 0)).toBeGreaterThanOrEqual(0.25);
  });

  it("skippedSlots deactivates cafe without profile skipBreakfast", () => {
    const profile = baseProfile();
    const plan = buildDailyMealPlan(profile, { ...emptyState, profile }, undefined, null, {
      skippedSlots: ["cafe"],
    });
    expect(plan.slots.find((s) => s.slot === "cafe")?.status).toBe("skipped");
  });

  it("counts whey doses in macros only when opted in", () => {
    const profile = baseProfile({
      nutritionProfile: {
        foodPreferences: [],
        foodRestrictions: [],
        countWheyInMacros: true,
      },
    });
    const date = "2026-09-19";
    const state: AppState = {
      ...emptyState,
      profile,
      supplementDoseLogs: [
        {
          id: "w1",
          productId: "whey-protein",
          dose: 1,
          unit: "scoop",
          frequency: "1x_day",
          takenAt: `${date}T10:00:00.000Z`,
          source: "manual",
        },
      ],
    };
    const off = dayNutritionTotalsFromState({ ...state, profile: baseProfile() }, date);
    const on = dayNutritionTotalsFromState(state, date);
    expect(off.proteinG).toBe(0);
    expect(on.proteinG).toBe(24);
    expect(on.kcal).toBe(120);
  });
});

describe("fast-path onboarding nutrition", () => {
  it("uses a safe weight fallback until body is completed", () => {
    const incomplete = nutritionGoals(baseProfile({ age: 0, heightCm: 0, weightKg: 0 }));
    const complete = nutritionGoals(baseProfile({ weightKg: 75 }));
    expect(incomplete.proteinG).toBe(complete.proteinG);
    expect(incomplete.kcal).toBeGreaterThan(1400);
  });
});

describe("reorder SKU", () => {
  it("picks the first mapped product for repurchase", () => {
    expect(primaryReorderProductId(["whey-protein", "creatina"])).toBe("whey-protein");
    expect(primaryReorderUrl(["whey-protein"])).toContain("/products/");
    expect(primaryReorderProductId([])).toBeNull();
  });
});
