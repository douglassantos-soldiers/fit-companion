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
  await db
    .from("orders")
    .update({
      financial_status: "refunded",
      updated_at: new Date().toISOString(),
    })
    .eq("shopify_order_id", String(shopifyOrderId));
}
