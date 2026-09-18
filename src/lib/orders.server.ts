/**
 * Persist Shopify orders + items. Server-only. Idempotent on shopify_order_id.
 */
import {
  mapLineItemsToProductIds,
  type ShopifyLineItemLike,
} from "@/data/shopify-product-map";
import type { PaidOrder } from "@/lib/shopify-orders.server";
import type { OrderSnapshot } from "@/lib/shopify.server";
import { adminDbLoose } from "@/lib/db-admin";

export async function upsertShopifyOrder(opts: {
  userId?: string | null;
  order:
    | PaidOrder
    | (OrderSnapshot & {
        financial_status?: string;
        total?: number;
        currency?: string;
      });
}): Promise<string | null> {
  const db = await adminDbLoose();
  if (!db) return null;

  const o = opts.order;
  const shopifyOrderId =
    "orderId" in o && o.orderId
      ? String(o.orderId)
      : "id" in o && o.id != null
        ? String(o.id)
        : null;
  if (!shopifyOrderId) return null;

  const email =
    ("email" in o && o.email ? String(o.email) : "").trim().toLowerCase() || null;
  const orderedAt =
    ("orderedAt" in o && o.orderedAt) ||
    ("processed_at" in o && o.processed_at) ||
    ("created_at" in o && o.created_at) ||
    new Date().toISOString();

  const customerId =
    ("customerId" in o && o.customerId) ||
    ("customer" in o && o.customer?.id != null ? String(o.customer.id) : null) ||
    null;

  const total =
    ("total" in o && typeof o.total === "number" ? o.total : null) ??
    ("total_price" in o && o.total_price != null ? Number(o.total_price) : null);

  const financialStatus =
    ("financial_status" in o && o.financial_status) ||
    ("accessTier" in o ? "paid" : null);

  const fulfillmentStatus =
    "fulfillment_status" in o ? (o.fulfillment_status as string | null) : null;

  const currency = ("currency" in o && o.currency) || "BRL";

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("orders")
    .upsert(
      {
        shopify_order_id: shopifyOrderId,
        user_id: opts.userId ?? null,
        ordered_at: orderedAt,
        total,
        currency,
        financial_status: financialStatus,
        fulfillment_status: fulfillmentStatus,
        channel: "shopify",
        email,
        shopify_customer_id: customerId,
        raw_snapshot: JSON.parse(JSON.stringify(o)),
        updated_at: now,
      },
      { onConflict: "shopify_order_id" },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("upsertShopifyOrder failed", error);
    return null;
  }

  const orderId = (data?.id as string | undefined) ?? null;
  if (!orderId) return null;

  const lineItems: Array<
    ShopifyLineItemLike & { variant_id?: unknown; price?: string; product_id?: unknown }
  > =
    ("lineItems" in o ? o.lineItems : null) ??
    ("line_items" in o ? o.line_items : null) ??
    [];

  await db.from("order_items").delete().eq("order_id", orderId);

  if (lineItems.length) {
    const better = lineItems.map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unit = item.price != null ? Number(item.price) : null;
      const pid = mapLineItemsToProductIds([item])[0] ?? null;
      return {
        order_id: orderId,
        product_id: pid,
        variant_id: item.variant_id != null ? String(item.variant_id) : null,
        product_title: item.title ?? null,
        quantity: qty,
        unit_price: unit,
        total_price: unit != null ? unit * qty : null,
      };
    });
    const { error: itemErr } = await db.from("order_items").insert(better);
    if (itemErr) console.error("order_items insert failed", itemErr);
  }

  return orderId;
}

export async function upsertOrdersFromPaidList(opts: {
  userId: string | null;
  orders: PaidOrder[];
}): Promise<number> {
  let n = 0;
  for (const order of opts.orders) {
    const id = await upsertShopifyOrder({ userId: opts.userId, order });
    if (id) n += 1;
  }
  return n;
}

export async function markOrderRefunded(shopifyOrderId: string): Promise<void> {
  const db = await adminDbLoose();
  if (!db) return;
  const oid = String(shopifyOrderId);
  await db
    .from("orders")
    .update({
      financial_status: "refunded",
      updated_at: new Date().toISOString(),
    })
    .eq("shopify_order_id", oid);

  // Revoke entitlements when no other paid orders remain for the user
  const { data: order } = await db
    .from("orders")
    .select("user_id, email")
    .eq("shopify_order_id", oid)
    .maybeSingle();

  const userId = (order?.user_id as string | null) ?? null;
  if (!userId) return;

  const { data: paid } = await db
    .from("orders")
    .select("id, financial_status")
    .eq("user_id", userId);

  const stillPaid = (paid ?? []).some((o) => {
    const s = String(o.financial_status ?? "").toLowerCase();
    return s === "paid" || s === "partially_paid";
  });

  if (stillPaid) {
    void import("@/lib/customer360/recompute.server")
      .then(({ recomputeCustomerProfile }) => recomputeCustomerProfile(userId))
      .catch(() => undefined);
    return;
  }

  // Soft-revoke: clear device + email entitlement rows
  const { data: devices } = await db.from("devices").select("device_id").eq("user_id", userId);
  for (const d of devices ?? []) {
    await db.from("app_entitlements").delete().eq("device_id", d.device_id);
  }

  const { data: user } = await db.from("users").select("email").eq("id", userId).maybeSingle();
  const email = (user?.email as string | null) ?? (order?.email as string | null);
  if (email) {
    try {
      await db.from("app_entitlement_emails").delete().eq("email", email.toLowerCase());
    } catch {
      /* table may use different key */
    }
  }

  void import("@/lib/customer360/recompute.server")
    .then(({ recomputeCustomerProfile }) => recomputeCustomerProfile(userId))
    .catch(() => undefined);
}
