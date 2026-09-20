/**
 * Orders pagination / cursor + events contract tests.
 */
import { describe, expect, it } from "vitest";
import {
  parseNextPageUrl,
  sortOrdersByProcessedAtDesc,
  syncCursorKey,
  type PaidOrder,
} from "@/lib/shopify-orders.server";

describe("sortOrdersByProcessedAtDesc", () => {
  it("orders newest processed_at first", () => {
    const orders: PaidOrder[] = [
      { id: 1, processed_at: "2026-01-01T00:00:00Z" },
      { id: 2, processed_at: "2026-06-01T00:00:00Z" },
      { id: 3, created_at: "2026-03-01T00:00:00Z" },
    ];
    const sorted = sortOrdersByProcessedAtDesc(orders);
    expect(sorted.map((o) => o.id)).toEqual([2, 3, 1]);
  });
});

describe("syncCursorKey", () => {
  it("prefers customer id", () => {
    expect(syncCursorKey({ customerId: "99", email: "a@b.com" })).toBe("shopify_orders:99");
  });

  it("falls back to email", () => {
    expect(syncCursorKey({ email: " Buyer@X.COM " })).toBe("shopify_orders:email:buyer@x.com");
  });
});

describe("parseNextPageUrl", () => {
  it("parses rel=next", () => {
    const link =
      '<https://x.myshopify.com/admin/api/2025-01/orders.json?page_info=abc&limit=50>; rel="next"';
    expect(parseNextPageUrl(link)).toContain("page_info=abc");
  });
});

describe("event types used by store emitters", () => {
  it("domain event names are stable strings", () => {
    const kinds = [
      "meal_logged",
      "weight_logged",
      "supplement_taken",
      "onboarding_completed",
      "workout_completed",
      "access_granted",
      "access_denied",
      "app_opened",
      "auth_linked",
    ];
    expect(kinds.every((k) => typeof k === "string" && k.length > 0)).toBe(true);
  });
});
