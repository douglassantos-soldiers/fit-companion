/**
 * Identity + Customer 360 + weekday + score contract tests.
 * Run: npm test
 */
import { describe, expect, it } from "vitest";
import { buildWeeklyPlan, planDayForToday } from "@/lib/engine/plan";
import {
  adherenceScore,
  performanceDimensions,
  performanceScore,
} from "@/lib/engine/dimensions";
import { parseNextPageUrl } from "@/lib/shopify-orders.server";
import { buildOrderSnapshot } from "@/lib/shopify.server";
import { buildCustomer360FromState } from "@/lib/customer360";
import { buildUserContext } from "@/lib/engine/context";
import { extractUserPatterns } from "@/lib/engine/learning";
import { emptyState, type Profile } from "@/lib/types";
import { createHmac } from "node:crypto";
import { verifyShopifyHmacAsync } from "@/lib/shopify.server";

const baseProfile: Profile = {
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

describe("planDayForToday weekday (Sunday=0)", () => {
  it("Monday returns training day for 3x week", () => {
    const days = buildWeeklyPlan(baseProfile, []);
    // Mon = 1
    const mon = new Date("2026-09-14T12:00:00"); // Monday
    expect(mon.getDay()).toBe(1);
    const day = planDayForToday(days, mon);
    expect(day).not.toBeNull();
    expect(day!.weekday).toBe(1);
  });

  it("Sunday is rest (null) for 3x week — not next Monday", () => {
    const days = buildWeeklyPlan(baseProfile, []);
    const sun = new Date("2026-09-13T12:00:00"); // Sunday
    expect(sun.getDay()).toBe(0);
    expect(planDayForToday(days, sun)).toBeNull();
  });

  it("Tuesday mid-week rest is null for 3x (Mon/Wed/Fri)", () => {
    const days = buildWeeklyPlan(baseProfile, []);
    const tue = new Date("2026-09-15T12:00:00");
    expect(tue.getDay()).toBe(2);
    expect(planDayForToday(days, tue)).toBeNull();
  });
});

describe("performance score does not inflate from supplements", () => {
  it("excludes suplementacao from performanceScore", () => {
    const state = {
      ...emptyState,
      profile: baseProfile,
      supplementRoutine: ["whey-protein"],
      supplementLogs: {
        "2026-09-01": ["whey-protein"],
        "2026-09-02": ["whey-protein"],
      },
    };
    const dims = performanceDimensions(state, baseProfile);
    const supp = dims.find((d) => d.key === "suplementacao");
    expect(supp).toBeTruthy();
    const perf = performanceScore(dims);
    const withoutSupp = performanceScore(dims.filter((d) => d.key !== "suplementacao"));
    expect(perf).toBe(withoutSupp);
    expect(adherenceScore(dims)).toBeGreaterThanOrEqual(0);
  });

  it("zero supplement adherence is not floored to 40", () => {
    const state = {
      ...emptyState,
      profile: baseProfile,
      supplementRoutine: ["whey-protein", "creatina"],
      supplementLogs: {},
    };
    const dims = performanceDimensions(state, baseProfile);
    const supp = dims.find((d) => d.key === "suplementacao");
    expect(supp!.score).toBe(0);
  });
});

describe("Shopify pagination Link header", () => {
  it("parses rel=next", () => {
    const link =
      '<https://x.myshopify.com/admin/api/2025-01/orders.json?page_info=abc&limit=50>; rel="next", <https://x.myshopify.com/admin/api/2025-01/orders.json?page_info=xyz&limit=50>; rel="previous"';
    expect(parseNextPageUrl(link)).toContain("page_info=abc");
  });

  it("returns null without next", () => {
    expect(parseNextPageUrl(null)).toBeNull();
    expect(parseNextPageUrl('<https://x>; rel="previous"')).toBeNull();
  });
});

describe("webhook HMAC + order snapshot", () => {
  it("rejects invalid HMAC", async () => {
    await expect(verifyShopifyHmacAsync("{}", "bad", "secret")).resolves.toBe(false);
  });

  it("accepts valid HMAC", async () => {
    const secret = "s";
    const body = '{"id":1}';
    const hmac = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    await expect(verifyShopifyHmacAsync(body, hmac, secret)).resolves.toBe(true);
  });

  it("buildOrderSnapshot normalizes email", () => {
    const snap = buildOrderSnapshot({
      id: 1,
      email: "A@B.com",
      line_items: [{ title: "Creatina", quantity: 1 }],
    });
    expect(snap?.email).toBe("a@b.com");
  });
});

describe("Customer 360 + Context", () => {
  it("goals come from profile not products", () => {
    const state = {
      ...emptyState,
      profile: baseProfile,
      purchaseProductIds: ["termogenico"],
    };
    const c360 = buildCustomer360FromState(state, { userId: "u1" });
    expect(c360.goals.currentGoal).toBe("massa");
    expect(c360.goals.source).toBe("profile");
    expect(c360.commerce.productIds).toContain("termogenico");
  });

  it("buildUserContext returns signals structure", () => {
    const ctx = buildUserContext({ ...emptyState, profile: baseProfile });
    expect(ctx.date).toBeTruthy();
    expect(Array.isArray(ctx.signals)).toBe(true);
    expect(ctx.customer360.goals.source).toBe("profile");
  });

  it("extractUserPatterns returns weekday map", () => {
    const patterns = extractUserPatterns({
      ...emptyState,
      sessions: [
        {
          id: "1",
          dayId: "a",
          title: "A",
          date: "2026-09-14T12:00:00",
          durationMin: 40,
          exercises: [],
          volumeKg: 100,
        },
      ],
    });
    expect(patterns.weekdaySessionCounts[1]).toBe(1);
  });
});

describe("access session client payload contract", () => {
  it("parseEstablishAccessInput discards forged tier", async () => {
    const { parseEstablishAccessInput } = await import("@/lib/access-parse");
    const parsed = parseEstablishAccessInput({
      email: "x@y.com",
      deviceId: "device-uuid-here",
      accessTier: "performance",
      productIds: ["pre-treino"],
    });
    expect(Object.keys(parsed).sort()).toEqual(["deviceId", "email"]);
    expect(parsed.email).toBe("x@y.com");
  });
});
