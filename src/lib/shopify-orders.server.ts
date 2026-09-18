/**
 * Shopify Admin order fetch with cursor pagination.
 * Server-only.
 */
import type { ShopifyLineItemLike } from "@/data/shopify-product-map";

const PAID = new Set(["paid", "partially_paid"]);

export type PaidOrder = {
  id?: number | string;
  financial_status?: string;
  fulfillment_status?: string | null;
  email?: string;
  created_at?: string;
  processed_at?: string;
  total_price?: string;
  currency?: string;
  tags?: string;
  customer?: { id?: number | string; tags?: string; email?: string };
  line_items?: Array<
    ShopifyLineItemLike & {
      variant_id?: number | string;
      price?: string;
      product_id?: number | string;
    }
  >;
};

function shopifyConfig() {
  const domain = (process.env["SHOPIFY_STORE_DOMAIN"] ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const token = process.env["SHOPIFY_ADMIN_ACCESS_TOKEN"] ?? "";
  const version = process.env["SHOPIFY_API_VERSION"] ?? "2025-01";
  return { domain, token, version };
}

async function shopifyGetRaw(path: string): Promise<{ json: unknown; link: string | null }> {
  const { domain, token, version } = shopifyConfig();
  if (!domain || !token) throw new Error("not_configured");
  const url = path.startsWith("http")
    ? path
    : `https://${domain}/admin/api/${version}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Shopify Admin GET failed", res.status, t.slice(0, 200));
    throw new Error("upstream");
  }
  const json = await res.json();
  return { json, link: res.headers.get("Link") };
}

/** Parse Shopify Link header for rel="next" page_info URL. */
export function parseNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (m?.[1]) return m[1];
  }
  return null;
}

const MAX_PAGES = 5; // 5 * 50 = 250 orders max per sync run
const PAGE_LIMIT = 50;

export async function fetchPaidOrdersByEmailServer(
  email: string,
  opts?: { maxPages?: number },
): Promise<{ orders: PaidOrder[]; customerId: string | null }> {
  const maxPages = opts?.maxPages ?? MAX_PAGES;
  let customerId: string | null = null;

  try {
    const { json } = await shopifyGetRaw(
      `/customers/search.json?query=${encodeURIComponent(`email:${email}`)}&limit=1`,
    );
    const customers = (json as { customers?: Array<{ id: number }> }).customers;
    const c = customers?.[0];
    if (c) customerId = String(c.id);
  } catch {
    /* continue */
  }

  const all: PaidOrder[] = [];

  if (customerId) {
    let next: string | null =
      `/customers/${customerId}/orders.json?status=any&limit=${PAGE_LIMIT}`;
    let pages = 0;
    while (next && pages < maxPages) {
      const { json, link } = await shopifyGetRaw(next);
      const batch = ((json as { orders?: PaidOrder[] }).orders ?? []).filter((o) =>
        PAID.has(String(o.financial_status ?? "").toLowerCase()),
      );
      all.push(...batch);
      next = parseNextPageUrl(link);
      // If next is absolute URL, shopifyGetRaw handles it
      pages += 1;
    }
    return { orders: all, customerId };
  }

  let next: string | null =
    `/orders.json?email=${encodeURIComponent(email)}&status=any&limit=${PAGE_LIMIT}`;
  let pages = 0;
  while (next && pages < maxPages) {
    const { json, link } = await shopifyGetRaw(next);
    const list = (json as { orders?: PaidOrder[] }).orders ?? [];
    const paid = list.filter((o) => PAID.has(String(o.financial_status ?? "").toLowerCase()));
    all.push(...paid);
    if (!customerId) {
      const cid = list[0]?.customer?.id;
      if (cid != null) customerId = String(cid);
    }
    next = parseNextPageUrl(link);
    pages += 1;
  }

  return { orders: all, customerId };
}

export { PAGE_LIMIT, MAX_PAGES, PAID };
