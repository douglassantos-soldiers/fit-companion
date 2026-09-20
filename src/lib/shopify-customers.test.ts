/**
 * Shopify customer import: pagination, skip-without-email, identity keys, no access grant.
 */
import { describe, expect, it } from "vitest";
import {
  CUSTOMER_IMPORT_WRITES_ENTITLEMENT,
  CUSTOMERS_LIST_CURSOR_ID,
  accumulateShopifyCustomerImport,
  decideShopifyCustomerIngest,
  emptyShopifyCustomerImportTotals,
  normalizeShopifyCustomerEmail,
  shopifyIdentityUpsertKeys,
} from "@/lib/shopify-customers";
import { parseCustomersPage, parseNextPageUrl } from "@/lib/shopify-orders.server";

describe("parseCustomersPage", () => {
  it("maps REST customers and skips blank ids", () => {
    const rows = parseCustomersPage({
      customers: [
        {
          id: 11,
          email: "Buyer@Soldiers.com",
          first_name: "Ana",
          last_name: "Silva",
          tags: "vip,  wholesale ",
          created_at: "2026-01-01T00:00:00Z",
          orders_count: 3,
        },
        { id: 12, email: "", orders_count: 0 },
        { email: "ghost@x.com" },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "11",
      email: "buyer@soldiers.com",
      firstName: "Ana",
      lastName: "Silva",
      ordersCount: 3,
    });
    expect(rows[0]?.tags).toEqual(["vip", "wholesale"]);
    expect(rows[1]).toMatchObject({ id: "12", email: null, ordersCount: 0 });
  });
});

describe("customers list pagination", () => {
  it("parses rel=next on /customers.json", () => {
    const link =
      '<https://x.myshopify.com/admin/api/2025-01/customers.json?page_info=cust2&limit=25>; rel="next",' +
      ' <https://x.myshopify.com/admin/api/2025-01/customers.json?page_info=cust1&limit=25>; rel="previous"';
    expect(parseNextPageUrl(link)).toContain("page_info=cust2");
  });
});

describe("decideShopifyCustomerIngest", () => {
  it("skips customers without email", () => {
    expect(normalizeShopifyCustomerEmail("  ")).toBeNull();
    expect(
      decideShopifyCustomerIngest({ id: "9", email: null, fetchOrders: true, ordersCount: 4 }),
    ).toMatchObject({ skip: true, reason: "no_email", fetchOrders: false });
  });

  it("skips order fetch when orders_count is 0", () => {
    expect(
      decideShopifyCustomerIngest({
        id: "9",
        email: "a@b.com",
        fetchOrders: true,
        ordersCount: 0,
      }),
    ).toEqual({
      skip: false,
      reason: null,
      fetchOrders: false,
      email: "a@b.com",
      customerId: "9",
    });
  });

  it("creates by email without Shopify id, but does not fetch orders", () => {
    expect(
      decideShopifyCustomerIngest({ email: "a@b.com", fetchOrders: true, ordersCount: 2 }),
    ).toEqual({
      skip: false,
      reason: "no_id",
      fetchOrders: false,
      email: "a@b.com",
      customerId: "",
    });
  });

  it("does not fetch orders on webhook-style ingest", () => {
    expect(
      decideShopifyCustomerIngest({
        id: "9",
        email: "a@b.com",
        fetchOrders: false,
        ordersCount: 12,
      }).fetchOrders,
    ).toBe(false);
  });
});

describe("identity upsert is idempotent", () => {
  it("same customer maps to the same provider keys", () => {
    const a = shopifyIdentityUpsertKeys({ customerId: " 99 ", email: " Buyer@X.COM " });
    const b = shopifyIdentityUpsertKeys({ customerId: "99", email: "buyer@x.com" });
    expect(a).toEqual(b);
    expect(a).toEqual({
      provider: "shopify",
      external_customer_id: "99",
      external_email: "buyer@x.com",
    });
  });
});

describe("customer import never grants entitlement", () => {
  it("keeps wroteEntitlement false across batches", () => {
    expect(CUSTOMER_IMPORT_WRITES_ENTITLEMENT).toBe(false);
    expect(CUSTOMERS_LIST_CURSOR_ID).toBe("shopify_customers:list");
    const acc = accumulateShopifyCustomerImport(emptyShopifyCustomerImportTotals(), {
      processed: 10,
      created: 4,
      linked: 8,
      skippedNoEmail: 2,
      ordersUpserted: 5,
      errors: [{ customerId: "1" }],
      hasMore: true,
      wroteEntitlement: true,
    });
    expect(acc.wroteEntitlement).toBe(false);
    expect(acc.processed).toBe(10);
    expect(acc.errorCount).toBe(1);
    expect(acc.hasMore).toBe(true);
  });

  it("ingest server module does not write entitlements", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(new URL("./shopify-customers.server.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/upsertEntitlementEmail/);
    expect(src).not.toMatch(/upsertDeviceEntitlementAdmin/);
  });
});
