/**
 * Pure Shopify customer-import decisions (no Admin network, no entitlement grant).
 */
export const CUSTOMER_IMPORT_WRITES_ENTITLEMENT = false as const;
export const CUSTOMERS_LIST_CURSOR_ID = "shopify_customers:list";

export type ShopifyCustomerIngestDecision = {
  skip: boolean;
  reason: "no_id" | "no_email" | null;
  fetchOrders: boolean;
  email: string | null;
  customerId: string;
};

export function normalizeShopifyCustomerEmail(raw: unknown): string | null {
  const email = String(raw ?? "")
    .trim()
    .toLowerCase();
  return email.includes("@") ? email : null;
}

export function decideShopifyCustomerIngest(customer: {
  id?: string | null;
  email?: string | null;
  ordersCount?: number | null;
  fetchOrders?: boolean;
}): ShopifyCustomerIngestDecision {
  const customerId = String(customer.id ?? "").trim();
  const email = normalizeShopifyCustomerEmail(customer.email);
  if (!email) {
    return {
      skip: true,
      reason: customerId ? "no_email" : "no_id",
      fetchOrders: false,
      email,
      customerId,
    };
  }
  const wantsOrders = customer.fetchOrders === true;
  const hasOrders = customer.ordersCount == null || customer.ordersCount > 0;
  return {
    skip: false,
    reason: customerId ? null : "no_id",
    fetchOrders: wantsOrders && hasOrders && Boolean(customerId),
    email,
    customerId,
  };
}

export function shopifyIdentityUpsertKeys(opts: { customerId: string; email: string }): {
  provider: "shopify";
  external_customer_id: string;
  external_email: string;
} {
  return {
    provider: "shopify",
    external_customer_id: String(opts.customerId).trim(),
    external_email: opts.email.trim().toLowerCase(),
  };
}

export type ShopifyCustomerImportTotals = {
  processed: number;
  created: number;
  linked: number;
  skippedNoEmail: number;
  ordersUpserted: number;
  errorCount: number;
  hasMore: boolean;
  wroteEntitlement: false;
};

export type ShopifyCustomerImportBatchResult = ShopifyCustomerImportTotals & {
  errors: Array<{ customerId: string; message: string }>;
};

export function emptyShopifyCustomerImportTotals(): ShopifyCustomerImportTotals {
  return {
    processed: 0,
    created: 0,
    linked: 0,
    skippedNoEmail: 0,
    ordersUpserted: 0,
    errorCount: 0,
    hasMore: false,
    wroteEntitlement: false,
  };
}

export function accumulateShopifyCustomerImport(
  acc: ShopifyCustomerImportTotals,
  batch: {
    processed: number;
    created: number;
    linked: number;
    skippedNoEmail: number;
    ordersUpserted: number;
    errors?: unknown[];
    hasMore: boolean;
    wroteEntitlement?: boolean;
  },
): ShopifyCustomerImportTotals {
  return {
    processed: acc.processed + batch.processed,
    created: acc.created + batch.created,
    linked: acc.linked + batch.linked,
    skippedNoEmail: acc.skippedNoEmail + batch.skippedNoEmail,
    ordersUpserted: acc.ordersUpserted + batch.ordersUpserted,
    errorCount: acc.errorCount + (batch.errors?.length ?? 0),
    hasMore: batch.hasMore,
    wroteEntitlement: false,
  };
}
