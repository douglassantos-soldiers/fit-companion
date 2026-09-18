/**
 * Webhook topic routing + idempotency hash contract (no Shopify network).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isCustomerTopic,
  isOrderTopic,
  isRefundTopic,
  normalizeWebhookTopic,
  webhookPayloadHashInput,
} from "@/lib/shopify-webhook-topics";
import { sha256Hex } from "@/lib/shopify.server";
import { enrichRestockConfidence, type RestockEstimate } from "@/data/shopify-product-map";

describe("Shopify webhook topic helpers", () => {
  it("normalizes and classifies topics", () => {
    expect(normalizeWebhookTopic(" Customers/Update ")).toBe("customers/update");
    expect(isCustomerTopic("customers/create")).toBe(true);
    expect(isCustomerTopic("orders/paid")).toBe(false);
    expect(isRefundTopic("refunds/create")).toBe(true);
    expect(isRefundTopic("orders/updated")).toBe(false);
    expect(isOrderTopic("orders/paid")).toBe(true);
    expect(isOrderTopic("orders/create")).toBe(true);
    expect(isOrderTopic("customers/create")).toBe(false);
  });

  it("idempotency hash input is topic:rawBody (lowercase topic)", async () => {
    const topic = "Orders/Paid";
    const body = '{"id":1}';
    const input = webhookPayloadHashInput(topic, body);
    expect(input).toBe("orders/paid:{\"id\":1}");

    const fromSubtle = await sha256Hex(input);
    const fromNode = createHash("sha256").update(input, "utf8").digest("hex");
    expect(fromSubtle).toBe(fromNode);
    expect(fromSubtle).toHaveLength(64);
  });
});

describe("enrichRestockConfidence", () => {
  it("raises confidence with consumption log days", () => {
    const estimates: Record<string, RestockEstimate> = {
      creatina: {
        productId: "creatina",
        emptyAt: new Date().toISOString(),
        daysLeft: 30,
        quantity: 1,
        confidence: 0.4,
      },
    };
    const logs = {
      creatina: ["2026-09-01", "2026-09-02"],
      whey: ["2026-09-01"],
    };
    const enriched = enrichRestockConfidence(estimates, logs);
    // 0.4 + 2 * 0.025 = 0.45 (two products with non-empty logs)
    expect(enriched.creatina?.confidence).toBeCloseTo(0.45, 5);
  });
});
