import { createServerFn } from "@tanstack/react-start";
import {
  estimateRestock,
  mapLineItemsToProductIds,
  resolveAccessTier,
  type AccessTier,
  type RestockEstimate,
  type ShopifyLineItemLike,
} from "@/data/shopify-product-map";

/**
 * Shopify purchase verification + companion (server-only).
 *
 * Env (never VITE_):
 *   SHOPIFY_STORE_DOMAIN — e.g. minha-loja.myshopify.com
 *   SHOPIFY_ADMIN_ACCESS_TOKEN — shpat_...
 *   SHOPIFY_API_VERSION — default 2025-01
 *   SHOPIFY_WEBHOOK_SECRET — HMAC for /api/shopify/webhook
 *   SHOPIFY_STOREFRONT_TOKEN — Storefront API (Fase 4)
 *   APP_ORIGIN — public app URL for magic links
 */

export type VerifyShopifyResult =
  | {
      ok: true;
      orderCount: number;
      customerId: string | null;
      productIds: string[];
      accessTier: AccessTier;
      restockEstimates: Record<string, RestockEstimate>;
    }
  | { ok: false; reason: "no_purchase" | "not_configured" | "invalid_email" | "upstream" };

export type RedeemMagicResult =
  | {
      ok: true;
      email: string;
      orderCount: number;
      customerId: string | null;
      productIds: string[];
      accessTier: AccessTier;
      restockEstimates: Record<string, RestockEstimate>;
    }
  | { ok: false; reason: "invalid" | "expired" | "not_configured" };

export type StorefrontProduct = {
  handle: string;
  title: string;
  productId: string | null;
  price: string | null;
  imageUrl: string | null;
  available: boolean;
  url: string;
};

const DENY_MSG = "Não encontramos compra paga com este e-mail";

/** Simple in-memory rate limit: max 8 attempts / email / 15 min */
const rateHits = new Map<string, { n: number; resetAt: number }>();

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

function rateLimit(email: string): boolean {
  const now = Date.now();
  const cur = rateHits.get(email);
  if (!cur || cur.resetAt < now) {
    rateHits.set(email, { n: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  if (cur.n >= 8) return false;
  cur.n += 1;
  return true;
}

function parseEmailInput(input: unknown): { email: string } {
  const value = input as { email?: string } | null;
  const email = normalizeEmail(String(value?.email ?? ""));
  if (!isValidEmail(email)) throw new Error("E-mail inválido");
  return { email };
}

/** Exported for contract / smoke tests. */
export function parseVerifyPurchaseInput(input: unknown): { email: string } {
  return parseEmailInput(input);
}

function shopifyConfig() {
  const domain = (process.env["SHOPIFY_STORE_DOMAIN"] ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const token = process.env["SHOPIFY_ADMIN_ACCESS_TOKEN"] ?? "";
  const version = process.env["SHOPIFY_API_VERSION"] ?? "2025-01";
  return { domain, token, version };
}

function storefrontConfig() {
  const domain = (process.env["SHOPIFY_STORE_DOMAIN"] ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const token = process.env["SHOPIFY_STOREFRONT_TOKEN"] ?? "";
  const version = process.env["SHOPIFY_API_VERSION"] ?? "2025-01";
  const publicUrl =
    process.env["VITE_SHOPIFY_STOREFRONT_URL"] ??
    (domain ? `https://${domain.replace(".myshopify.com", "")}` : "https://soldiersnutrition.com.br");
  return { domain, token, version, publicUrl: String(publicUrl).replace(/\/$/, "") };
}

async function shopifyGet<T>(path: string): Promise<T> {
  const { domain, token, version } = shopifyConfig();
  const url = `https://${domain}/admin/api/${version}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Shopify Admin API error", res.status, detail.slice(0, 200));
    throw new Error("upstream");
  }
  return (await res.json()) as T;
}

const PAID = new Set(["paid", "partially_paid"]);

type PaidOrder = {
  financial_status?: string;
  email?: string;
  created_at?: string;
  processed_at?: string;
  tags?: string;
  customer?: { id?: number; tags?: string };
  line_items?: ShopifyLineItemLike[];
};

async function fetchPaidOrdersByEmail(email: string): Promise<{
  orders: PaidOrder[];
  customerId: string | null;
}> {
  let customerId: string | null = null;
  try {
    const customers = await shopifyGet<{
      customers?: Array<{ id: number; email?: string }>;
    }>(`/customers/search.json?query=${encodeURIComponent(`email:${email}`)}&limit=1`);
    const c = customers.customers?.[0];
    if (c) customerId = String(c.id);
  } catch {
    /* continue */
  }

  if (customerId) {
    const orders = await shopifyGet<{ orders?: PaidOrder[] }>(
      `/customers/${customerId}/orders.json?status=any&limit=50`,
    );
    const paid = (orders.orders ?? []).filter((o) => PAID.has(String(o.financial_status ?? "").toLowerCase()));
    return { orders: paid, customerId };
  }

  const orders = await shopifyGet<{ orders?: PaidOrder[] }>(
    `/orders.json?email=${encodeURIComponent(email)}&status=any&limit=50`,
  );
  const list = orders.orders ?? [];
  const paid = list.filter((o) => PAID.has(String(o.financial_status ?? "").toLowerCase()));
  const cid = list[0]?.customer?.id;
  return { orders: paid, customerId: cid != null ? String(cid) : null };
}

function profileFromOrders(orders: PaidOrder[], customerId: string | null) {
  const latest = orders[0];
  const lineItems = latest?.line_items ?? [];
  const productIds = mapLineItemsToProductIds(
    orders.flatMap((o) => o.line_items ?? []).length
      ? orders.flatMap((o) => o.line_items ?? [])
      : lineItems,
  ).slice(0, 5);
  const tags = `${latest?.tags ?? ""} ${latest?.customer?.tags ?? ""}`
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const accessTier = resolveAccessTier(productIds, tags);
  const orderedAt = latest?.processed_at || latest?.created_at || new Date().toISOString();
  const restockEstimates = estimateRestock(productIds, latest?.line_items ?? [], orderedAt);
  return { productIds, customerId, accessTier, restockEstimates, orderCount: orders.length };
}

export const verifyShopifyPurchase = createServerFn({ method: "POST" })
  .inputValidator(parseEmailInput)
  .handler(async ({ data }): Promise<VerifyShopifyResult> => {
    const { domain, token } = shopifyConfig();
    if (!domain || !token) {
      console.error("Shopify not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN)");
      return { ok: false, reason: "not_configured" };
    }

    if (!rateLimit(data.email)) {
      console.warn("Shopify verify rate limited", maskEmail(data.email));
      return { ok: false, reason: "no_purchase" };
    }

    try {
      // Prefer snapshot from webhook table when available
      try {
        const { findEntitlementByEmail } = await import("@/lib/shopify.server");
        const row = await findEntitlementByEmail(data.email);
        if (row) {
          const { orders, customerId } = await fetchPaidOrdersByEmail(data.email);
          if (orders.length < 1 && row.productIds.length === 0) {
            return { ok: false, reason: "no_purchase" };
          }
          const fromOrders =
            orders.length > 0
              ? profileFromOrders(orders, customerId ?? row.customerId)
              : {
                  productIds: row.productIds,
                  customerId: row.customerId,
                  accessTier: row.accessTier,
                  restockEstimates: row.snapshot?.restockEstimates ?? {},
                  orderCount: 1,
                };
          return {
            ok: true,
            orderCount: fromOrders.orderCount,
            customerId: fromOrders.customerId,
            productIds: fromOrders.productIds.length ? fromOrders.productIds : row.productIds,
            accessTier: fromOrders.accessTier,
            restockEstimates: fromOrders.restockEstimates,
          };
        }
      } catch {
        /* admin may be missing — fall through to Admin API only */
      }

      const { orders, customerId } = await fetchPaidOrdersByEmail(data.email);
      if (orders.length < 1) {
        console.info("Shopify verify: no paid order", maskEmail(data.email));
        return { ok: false, reason: "no_purchase" };
      }
      const profile = profileFromOrders(orders, customerId);
      console.info("Shopify verify: granted", maskEmail(data.email), "orders=", profile.orderCount);
      return {
        ok: true,
        orderCount: profile.orderCount,
        customerId: profile.customerId,
        productIds: profile.productIds,
        accessTier: profile.accessTier,
        restockEstimates: profile.restockEstimates,
      };
    } catch (e) {
      if (e instanceof Error && e.message === "upstream") {
        return { ok: false, reason: "upstream" };
      }
      console.error("Shopify verify failed", e);
      return { ok: false, reason: "upstream" };
    }
  });

export const redeemMagicToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const value = input as { token?: string } | null;
    const token = String(value?.token ?? "").trim();
    if (!token || token.length < 8) throw new Error("Token inválido");
    return { token };
  })
  .handler(async ({ data }): Promise<RedeemMagicResult> => {
    try {
      const { findEntitlementByMagicToken } = await import("@/lib/shopify.server");
      const row = await findEntitlementByMagicToken(data.token);
      if (!row) return { ok: false, reason: "invalid" };
      return {
        ok: true,
        email: row.email,
        orderCount: row.orderCount,
        customerId: row.customerId,
        productIds: row.productIds,
        accessTier: row.accessTier,
        restockEstimates: row.snapshot?.restockEstimates ?? {},
      };
    } catch (e) {
      console.error("redeemMagicToken failed", e);
      return { ok: false, reason: "not_configured" };
    }
  });

export const fetchStorefrontCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: StorefrontProduct[]; configured: boolean }> => {
    const { domain, token, version, publicUrl } = storefrontConfig();
    const { SHOPIFY_PRODUCT_MAP } = await import("@/data/shopify-product-map");

    if (!domain || !token) {
      return {
        configured: false,
        products: SHOPIFY_PRODUCT_MAP.map((e) => ({
          handle: e.shopifyHandle,
          title: e.productId,
          productId: e.productId,
          price: null,
          imageUrl: null,
          available: true,
          url: `${publicUrl}/products/${e.shopifyHandle}`,
        })),
      };
    }

    const products: StorefrontProduct[] = [];
    for (const entry of SHOPIFY_PRODUCT_MAP) {
      try {
        const gql = `
          query ProductByHandle($handle: String!) {
            product(handle: $handle) {
              title
              handle
              availableForSale
              featuredImage { url }
              priceRange { minVariantPrice { amount currencyCode } }
            }
          }
        `;
        const res = await fetch(`https://${domain}/api/${version}/graphql.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": token,
          },
          body: JSON.stringify({ query: gql, variables: { handle: entry.shopifyHandle } }),
        });
        if (!res.ok) {
          products.push({
            handle: entry.shopifyHandle,
            title: entry.productId,
            productId: entry.productId,
            price: null,
            imageUrl: null,
            available: true,
            url: `${publicUrl}/products/${entry.shopifyHandle}`,
          });
          continue;
        }
        const json = (await res.json()) as {
          data?: {
            product?: {
              title?: string;
              handle?: string;
              availableForSale?: boolean;
              featuredImage?: { url?: string } | null;
              priceRange?: { minVariantPrice?: { amount?: string; currencyCode?: string } };
            } | null;
          };
        };
        const p = json.data?.product;
        if (!p) {
          products.push({
            handle: entry.shopifyHandle,
            title: entry.productId,
            productId: entry.productId,
            price: null,
            imageUrl: null,
            available: true,
            url: `${publicUrl}/products/${entry.shopifyHandle}`,
          });
          continue;
        }
        const amount = p.priceRange?.minVariantPrice?.amount;
        const currency = p.priceRange?.minVariantPrice?.currencyCode ?? "BRL";
        products.push({
          handle: p.handle ?? entry.shopifyHandle,
          title: p.title ?? entry.productId,
          productId: entry.productId,
          price: amount ? `${currency} ${Number(amount).toFixed(2)}` : null,
          imageUrl: p.featuredImage?.url ?? null,
          available: p.availableForSale !== false,
          url: `${publicUrl}/products/${p.handle ?? entry.shopifyHandle}`,
        });
      } catch {
        products.push({
          handle: entry.shopifyHandle,
          title: entry.productId,
          productId: entry.productId,
          price: null,
          imageUrl: null,
          available: true,
          url: `${publicUrl}/products/${entry.shopifyHandle}`,
        });
      }
    }
    return { configured: true, products };
  },
);

export const trackAppEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const value = input as { deviceId?: string; kind?: string; payload?: Record<string, unknown> } | null;
    const deviceId = String(value?.deviceId ?? "").trim();
    const kind = String(value?.kind ?? "").trim();
    if (!deviceId || !kind) throw new Error("deviceId e kind obrigatórios");
    return { deviceId, kind, payload: value?.payload ?? {} };
  })
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const { insertEngagementEvent } = await import("@/lib/shopify.server");
      await insertEngagementEvent({
        deviceId: data.deviceId,
        kind: data.kind,
        payload: data.payload,
      });
      return { ok: true };
    } catch (e) {
      console.warn("trackAppEvent failed", e);
      return { ok: false };
    }
  });

export { DENY_MSG, normalizeEmail };
