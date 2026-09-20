/**
 * Shopify Admin order fetch with cursor pagination + persisted cursors.
 * Server-only.
 */
import type { ShopifyLineItemLike } from "@/data/shopify-product-map";
import { adminDbLoose } from "@/lib/db-admin";

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

/** Sort paid orders by processed_at || created_at descending. */
export function sortOrdersByProcessedAtDesc(orders: PaidOrder[]): PaidOrder[] {
  return [...orders].sort((a, b) => {
    const ta = new Date(a.processed_at || a.created_at || 0).getTime();
    const tb = new Date(b.processed_at || b.created_at || 0).getTime();
    return tb - ta;
  });
}

export function syncCursorKey(opts: { customerId?: string | null; email?: string }): string {
  if (opts.customerId) return `shopify_orders:${opts.customerId}`;
  return `shopify_orders:email:${(opts.email ?? "").trim().toLowerCase()}`;
}

export async function getSyncCursor(id: string): Promise<string | null> {
  try {
    const db = await adminDbLoose();
    if (!db) return null;
    const { data } = await db
      .from("shopify_sync_cursors")
      .select("cursor_value")
      .eq("id", id)
      .maybeSingle();
    return (data?.cursor_value as string | null) ?? null;
  } catch {
    return null;
  }
}

export async function setSyncCursor(id: string, value: string | null): Promise<void> {
  try {
    const db = await adminDbLoose();
    if (!db) return;
    if (value == null || value === "") {
      await db.from("shopify_sync_cursors").delete().eq("id", id);
      return;
    }
    await db.from("shopify_sync_cursors").upsert({
      id,
      cursor_value: value,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("setSyncCursor skipped", e);
  }
}

/** Max pages per sync run (20 × 50 = 1000). Full history = loop until hasMore=false via cursor. */
const MAX_PAGES = 20;
const PAGE_LIMIT = 50;
/** One Admin list page per import batch — keeps the server fn under Shopify rate limits. */
export const CUSTOMER_PAGE_LIMIT = 25;
/** Order pages pulled per customer inside one import batch; remaining pages resume via cursor. */
export const MAX_ORDER_PAGES_PER_CUSTOMER_BATCH = 2;

export type ShopifyCustomerListItem = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tags: string[];
  createdAt: string | null;
  ordersCount: number;
};

function parseCustomerTags(raw: string | null | undefined): string[] {
  return String(raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Map REST `/customers.json` payload — email/name/tags/orders_count only. */
export function parseCustomersPage(json: unknown): ShopifyCustomerListItem[] {
  const customers =
    (json as {
      customers?: Array<{
        id?: number | string;
        email?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        tags?: string | null;
        created_at?: string | null;
        orders_count?: number | string | null;
      }>;
    }).customers ?? [];

  return customers
    .map((c) => {
      const id = c.id != null ? String(c.id).trim() : "";
      const emailRaw = String(c.email ?? "")
        .trim()
        .toLowerCase();
      return {
        id,
        email: emailRaw.includes("@") ? emailRaw : null,
        firstName: c.first_name?.trim() || null,
        lastName: c.last_name?.trim() || null,
        tags: parseCustomerTags(c.tags),
        createdAt: c.created_at ?? null,
        ordersCount: Number(c.orders_count ?? 0) || 0,
      };
    })
    .filter((c) => Boolean(c.id));
}

async function paginatePaidOrders(opts: {
  startPath: string;
  cursorId: string;
  maxPages: number;
  resumeCursor: boolean;
  initialCustomerId?: string | null;
}): Promise<{ orders: PaidOrder[]; customerId: string | null; hasMore: boolean }> {
  const saved = opts.resumeCursor ? await getSyncCursor(opts.cursorId) : null;
  let customerId = opts.initialCustomerId ?? null;
  const all: PaidOrder[] = [];
  let next: string | null = saved ?? opts.startPath;
  let pages = 0;

  while (next && pages < opts.maxPages) {
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

  const hasMore = Boolean(next);
  if (hasMore && next) {
    await setSyncCursor(opts.cursorId, next);
  } else {
    await setSyncCursor(opts.cursorId, null);
  }

  return {
    orders: sortOrdersByProcessedAtDesc(all),
    customerId,
    hasMore,
  };
}

export async function fetchPaidOrdersByEmailServer(
  email: string,
  opts?: { maxPages?: number; resumeCursor?: boolean },
): Promise<{ orders: PaidOrder[]; customerId: string | null; hasMore: boolean }> {
  const maxPages = opts?.maxPages ?? MAX_PAGES;
  const resumeCursor = opts?.resumeCursor !== false;
  let customerId: string | null = null;
  const normalized = email.trim().toLowerCase();

  try {
    const { json } = await shopifyGetRaw(
      `/customers/search.json?query=${encodeURIComponent(`email:${normalized}`)}&limit=1`,
    );
    const customers = (json as { customers?: Array<{ id: number }> }).customers;
    const c = customers?.[0];
    if (c) customerId = String(c.id);
  } catch {
    /* continue */
  }

  const startPath = customerId
    ? `/customers/${customerId}/orders.json?status=any&limit=${PAGE_LIMIT}`
    : `/orders.json?email=${encodeURIComponent(normalized)}&status=any&limit=${PAGE_LIMIT}`;

  return paginatePaidOrders({
    startPath,
    cursorId: syncCursorKey({ customerId, email: normalized }),
    maxPages,
    resumeCursor,
    initialCustomerId: customerId,
  });
}

export async function fetchPaidOrdersByCustomerIdServer(
  customerId: string,
  opts?: { maxPages?: number; resumeCursor?: boolean },
): Promise<{ orders: PaidOrder[]; customerId: string; hasMore: boolean }> {
  const id = String(customerId ?? "").trim();
  if (!id) {
    return { orders: [], customerId: "", hasMore: false };
  }
  const result = await paginatePaidOrders({
    startPath: `/customers/${encodeURIComponent(id)}/orders.json?status=any&limit=${PAGE_LIMIT}`,
    cursorId: syncCursorKey({ customerId: id }),
    maxPages: opts?.maxPages ?? MAX_PAGES,
    resumeCursor: opts?.resumeCursor !== false,
    initialCustomerId: id,
  });
  return { orders: result.orders, customerId: result.customerId ?? id, hasMore: result.hasMore };
}

/**
 * One REST `/customers.json` page. Does not persist the list cursor — caller advances
 * after ingesting the page so a failed batch can retry the same page.
 */
export async function fetchCustomersPageServer(opts?: {
  cursor?: string | null;
}): Promise<{
  customers: ShopifyCustomerListItem[];
  nextUrl: string | null;
  hasMore: boolean;
}> {
  const path = opts?.cursor || `/customers.json?limit=${CUSTOMER_PAGE_LIMIT}`;
  const { json, link } = await shopifyGetRaw(path);
  const nextUrl = parseNextPageUrl(link);
  return {
    customers: parseCustomersPage(json),
    nextUrl,
    hasMore: Boolean(nextUrl),
  };
}

/** Store customer card — name/tags only. Never phone, CPF, or address. */
export async function fetchShopifyCustomerServer(customerId: string): Promise<{
  firstName: string | null;
  lastName: string | null;
  tags: string[];
  createdAt: string | null;
} | null> {
  const id = String(customerId ?? "").trim();
  if (!id) return null;
  try {
    const { json } = await shopifyGetRaw(`/customers/${encodeURIComponent(id)}.json`);
    const c = (json as {
      customer?: {
        first_name?: string | null;
        last_name?: string | null;
        tags?: string | null;
        created_at?: string | null;
      };
    }).customer;
    if (!c) return null;
    const tags = String(c.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return {
      firstName: c.first_name?.trim() || null,
      lastName: c.last_name?.trim() || null,
      tags,
      createdAt: c.created_at ?? null,
    };
  } catch (e) {
    console.warn("fetchShopifyCustomerServer skipped", e);
    return null;
  }
}

export function shopifyDisplayName(opts: {
  firstName?: string | null;
  lastName?: string | null;
}): string | null {
  const name = `${opts.firstName ?? ""} ${opts.lastName ?? ""}`.trim();
  return name || null;
}

export { PAGE_LIMIT, MAX_PAGES, PAID };
