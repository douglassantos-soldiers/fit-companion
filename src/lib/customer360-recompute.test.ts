/**
 * Customer 360 recompute / commerce / lineage unit tests (pure helpers + build).
 */
import { describe, expect, it } from "vitest";
import { buildCustomer360FromState } from "@/lib/customer360";
import { computeCommerceFromOrders } from "@/lib/customer360/recompute.server";
import { mergeAppStateOverride } from "@/lib/customer360/hydrate.server";
import { buildDefaultLineage, buildEstimatesFromCommerce } from "@/lib/customer360/types";
import { emptyState, type Profile } from "@/lib/types";

const profile: Profile = {
  name: "Teste",
  goal: "massa",
  level: "iniciante",
  daysPerWeek: 3,
  age: 30,
  heightCm: 175,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
};

describe("computeCommerceFromOrders", () => {
  it("returns zeros with 0 orders", () => {
    const c = computeCommerceFromOrders([]);
    expect(c.totalOrders).toBe(0);
    expect(c.totalSpend).toBe(0);
    expect(c.averageOrderValue).toBeNull();
    expect(c.estimatedLtv).toBeNull();
    expect(c.favoriteProducts).toEqual([]);
  });

  it("aggregates spend, AOV, frequency from N paid orders", () => {
    const c = computeCommerceFromOrders(
      [
        {
          id: "o1",
          ordered_at: "2026-01-01T00:00:00.000Z",
          total: 100,
          financial_status: "paid",
        },
        {
          id: "o2",
          ordered_at: "2026-01-31T00:00:00.000Z",
          total: 200,
          financial_status: "paid",
        },
      ],
      [
        { order_id: "o1", product_id: "whey-protein" },
        { order_id: "o2", product_id: "whey-protein" },
        { order_id: "o2", product_id: "creatina" },
      ],
    );
    expect(c.totalOrders).toBe(2);
    expect(c.totalSpend).toBe(300);
    expect(c.averageOrderValue).toBe(150);
    expect(c.purchaseFrequencyDays).toBe(30);
    expect(c.favoriteProducts[0]).toBe("whey-protein");
    expect(c.estimatedLtv).not.toBeNull();
    expect(c.estimatedNextPurchase).not.toBeNull();
  });

  it("excludes refunded orders from paid totals", () => {
    const c = computeCommerceFromOrders([
      {
        id: "o1",
        ordered_at: "2026-01-01T00:00:00.000Z",
        total: 100,
        financial_status: "paid",
      },
      {
        id: "o2",
        ordered_at: "2026-02-01T00:00:00.000Z",
        total: 500,
        financial_status: "refunded",
      },
    ]);
    expect(c.totalOrders).toBe(1);
    expect(c.totalSpend).toBe(100);
  });

  it("multi-order favorites rank by item count", () => {
    const c = computeCommerceFromOrders(
      [
        { id: "a", ordered_at: "2026-01-01T00:00:00.000Z", total: 10, financial_status: "paid" },
        { id: "b", ordered_at: "2026-01-02T00:00:00.000Z", total: 10, financial_status: "paid" },
        { id: "c", ordered_at: "2026-01-03T00:00:00.000Z", total: 10, financial_status: "paid" },
      ],
      [
        { order_id: "a", product_id: "creatina" },
        { order_id: "b", product_id: "whey-protein" },
        { order_id: "c", product_id: "whey-protein" },
        { order_id: "c", product_id: "whey-protein" },
      ],
    );
    expect(c.favoriteProducts[0]).toBe("whey-protein");
    expect(c.favoriteProducts).toContain("creatina");
  });
});

describe("lineage + estimates", () => {
  it("marks estimatedLtv as estimated and total_spend as orders/observed", () => {
    const lineage = buildDefaultLineage();
    expect(lineage["estimated_ltv"]?.kind).toBe("estimated");
    expect(lineage["total_spend"]?.source).toBe("orders");
    expect(lineage["total_spend"]?.kind).toBe("observed");
    expect(lineage["training_frequency"]?.kind).toBe("derived");

    const commerce = computeCommerceFromOrders([
      {
        id: "o1",
        ordered_at: "2026-01-01T00:00:00.000Z",
        total: 80,
        financial_status: "paid",
      },
    ]);
    const estimates = buildEstimatesFromCommerce(commerce);
    expect(estimates.ltv.kind).toBe("estimate");
    expect(estimates.ltv.value).toBe(commerce.estimatedLtv);
    expect(estimates.nextPurchase.kind).toBe("estimate");
  });

  it("buildCustomer360FromState includes lineage and estimate kind on restock", () => {
    const c360 = buildCustomer360FromState({
      ...emptyState,
      profile,
      restockEstimates: {
        "whey-protein": {
          productId: "whey-protein",
          emptyAt: "2026-10-01T00:00:00.000Z",
          daysLeft: 14,
          quantity: 1,
          confidence: 0.5,
        },
      },
    });
    expect(c360.estimates.ltv.kind).toBe("estimate");
    expect(c360.lineage["total_spend"]?.source).toBe("orders");
    expect(c360.supplements.restockEstimates["whey-protein"]?.kind).toBe("estimate");
    expect(c360.shopifyCustomerId).toBeNull();
  });
});

describe("hydrate merge + aggregator scores", () => {
  it("mergeAppStateOverride lets client override win for present fields", () => {
    const base = { ...emptyState, userId: "u1", bio: "db" };
    const merged = mergeAppStateOverride(base, { bio: "client", chat: [] });
    expect(merged.bio).toBe("client");
    expect(merged.userId).toBe("u1");
  });

  it("sessions/meals/dayCheckIns produce scores ≠ empty", () => {
    const today = new Date().toISOString().slice(0, 10);
    const c360 = buildCustomer360FromState({
      ...emptyState,
      profile,
      sessions: [
        {
          id: "s1",
          dayId: "d1",
          title: "A",
          date: today,
          durationMin: 45,
          exercises: [],
          volumeKg: 300,
          rpe: "ok",
        },
      ],
      meals: [
        {
          id: "m1",
          date: today,
          slot: "almoco",
          label: "Frango",
          proteinG: 45,
          kcal: 500,
          quality: "green",
        },
      ],
      dayCheckIns: {
        [today]: { date: today, sleepHours: 7.5, energy: "ok", availableMin: 60 },
      },
      supplementRoutine: ["whey-protein"],
      supplementLogs: { [today]: ["whey-protein"] },
    });
    expect(c360.performance.sessions28d).toBeGreaterThan(0);
    expect(c360.nutrition.proteinAdherence7d).not.toBeNull();
    expect(c360.behavior.streak).toBeGreaterThanOrEqual(1);
    expect(c360.recovery.recoveryScore).not.toBeNull();
    expect(c360.goals.currentGoal).toBe("massa");
  });

  it("without commerce still keeps profile goal from state", () => {
    const c360 = buildCustomer360FromState({ ...emptyState, profile });
    expect(c360.commerce.totalOrders).toBe(0);
    expect(c360.goals.currentGoal).toBe("massa");
    expect(c360.goals.source).toBe("profile");
  });
});
