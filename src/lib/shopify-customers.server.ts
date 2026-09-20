/**
 * Shopify customer ingest + batched Admin list import.
 * Writes users, identities, and paid orders — never entitlements / access grants.
 */
import {
  CUSTOMERS_LIST_CURSOR_ID,
  CUSTOMER_IMPORT_WRITES_ENTITLEMENT,
  decideShopifyCustomerIngest,
  emptyShopifyCustomerImportTotals,
  type ShopifyCustomerImportBatchResult,
} from "@/lib/shopify-customers";
import {
  MAX_ORDER_PAGES_PER_CUSTOMER_BATCH,
  fetchCustomersPageServer,
  fetchPaidOrdersByCustomerIdServer,
  getSyncCursor,
  setSyncCursor,
  type ShopifyCustomerListItem,
} from "@/lib/shopify-orders.server";

export type IngestShopifyCustomerResult = {
  skippedNoEmail: boolean;
  created: boolean;
  linked: boolean;
  userId: string | null;
  ordersUpserted: number;
  wroteEntitlement: false;
};

export type ShopifyCustomerImportBatch = ShopifyCustomerImportBatchResult;

export async function ingestShopifyCustomer(opts: {
  customer: {
    id: string;
    email?: string | null;
    ordersCount?: number | null;
  };
  fetchOrders?: boolean;
  maxOrderPages?: number;
  allowExistingWithoutEmail?: boolean;
}): Promise<IngestShopifyCustomerResult> {
  const denied: IngestShopifyCustomerResult = {
    skippedNoEmail: false,
    created: false,
    linked: false,
    userId: null,
    ordersUpserted: 0,
    wroteEntitlement: CUSTOMER_IMPORT_WRITES_ENTITLEMENT,
  };

  const decision = decideShopifyCustomerIngest({
    id: opts.customer.id,
    email: opts.customer.email ?? null,
    ordersCount: opts.customer.ordersCount ?? null,
    fetchOrders: opts.fetchOrders === true,
  });

  const {
    resolveOrCreateUserByEmail,
    linkShopifyIdentity,
    findUserByShopifyCustomerId,
    findUserByEmail,
  } = await import("@/lib/identity");

  if (decision.skip && decision.reason === "no_email") {
    if (opts.allowExistingWithoutEmail && decision.customerId) {
      const existing = await findUserByShopifyCustomerId(decision.customerId);
      if (existing) {
        const linked = await linkShopifyIdentity({
          userId: existing.id,
          shopifyCustomerId: decision.customerId,
          externalEmail: null,
        });
        recomputeBestEffort(existing.id);
        return {
          ...denied,
          linked,
          userId: existing.id,
        };
      }
    }
    return { ...denied, skippedNoEmail: true };
  }

  if (decision.skip || !decision.email) {
    return denied;
  }

  const before = await findUserByEmail(decision.email);
  const user = await resolveOrCreateUserByEmail(decision.email);
  if (!user) return denied;

  const linked = decision.customerId
    ? await linkShopifyIdentity({
        userId: user.id,
        shopifyCustomerId: decision.customerId,
        externalEmail: decision.email,
      })
    : false;

  let ordersUpserted = 0;
  if (decision.fetchOrders) {
    const { upsertOrdersFromPaidList } = await import("@/lib/orders.server");
    const { orders } = await fetchPaidOrdersByCustomerIdServer(decision.customerId, {
      maxPages: opts.maxOrderPages ?? MAX_ORDER_PAGES_PER_CUSTOMER_BATCH,
    });
    ordersUpserted = await upsertOrdersFromPaidList({ userId: user.id, orders });
  }

  recomputeBestEffort(user.id);

  return {
    skippedNoEmail: false,
    created: !before,
    linked,
    userId: user.id,
    ordersUpserted,
    wroteEntitlement: CUSTOMER_IMPORT_WRITES_ENTITLEMENT,
  };
}

export async function importShopifyCustomersBatch(opts?: {
  reset?: boolean;
}): Promise<ShopifyCustomerImportBatch> {
  if (opts?.reset) {
    await setSyncCursor(CUSTOMERS_LIST_CURSOR_ID, null);
  }

  const saved = await getSyncCursor(CUSTOMERS_LIST_CURSOR_ID);
  const page = await fetchCustomersPageServer({ cursor: saved });

  const errors: Array<{ customerId: string; message: string }> = [];
  let created = 0;
  let linked = 0;
  let skippedNoEmail = 0;
  let ordersUpserted = 0;

  for (const customer of page.customers) {
    try {
      const result = await ingestShopifyCustomer({
        customer,
        fetchOrders: true,
        maxOrderPages: MAX_ORDER_PAGES_PER_CUSTOMER_BATCH,
      });
      if (result.skippedNoEmail) skippedNoEmail += 1;
      if (result.created) created += 1;
      if (result.linked) linked += 1;
      ordersUpserted += result.ordersUpserted;
    } catch (e) {
      errors.push({
        customerId: customer.id,
        message: e instanceof Error ? e.message : "ingest_failed",
      });
    }
  }

  await setSyncCursor(CUSTOMERS_LIST_CURSOR_ID, page.nextUrl);

  return {
    ...emptyShopifyCustomerImportTotals(),
    processed: page.customers.length,
    created,
    linked,
    skippedNoEmail,
    ordersUpserted,
    errorCount: errors.length,
    hasMore: page.hasMore,
    wroteEntitlement: CUSTOMER_IMPORT_WRITES_ENTITLEMENT,
    errors,
  };
}

export function customerCardFromWebhookPayload(
  payload: Record<string, unknown>,
): ShopifyCustomerListItem {
  const emailRaw = String(payload["email"] ?? "")
    .trim()
    .toLowerCase();
  return {
    id: payload["id"] != null ? String(payload["id"]) : "",
    email: emailRaw.includes("@") ? emailRaw : null,
    firstName: String(payload["first_name"] ?? "").trim() || null,
    lastName: String(payload["last_name"] ?? "").trim() || null,
    tags: String(payload["tags"] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    createdAt: payload["created_at"] != null ? String(payload["created_at"]) : null,
    ordersCount: Number(payload["orders_count"] ?? 0) || 0,
  };
}

function recomputeBestEffort(userId: string): void {
  void import("@/lib/customer360/recompute.server")
    .then(({ recomputeCustomerProfile }) => recomputeCustomerProfile(userId))
    .catch(() => undefined);
}
