/**
 * Server-only Shopify companion helpers (HMAC, email entitlements, magic tokens).
 * Import only from server routes / createServerFn handlers via dynamic import.
 */
import {
  estimateRestock,
  mapLineItemsToProductIds,
  resolveAccessTier,
  type AccessTier,
  type RestockEstimate,
  type ShopifyLineItemLike,
} from "@/data/shopify-product-map";

export type OrderSnapshot = {
  orderId: string | null;
  email: string;
  customerId: string | null;
  tags: string[];
  lineItems: ShopifyLineItemLike[];
  productIds: string[];
  accessTier: AccessTier;
  orderedAt: string;
  restockEstimates: Record<string, RestockEstimate>;
};

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Shopify sends base64 HMAC-SHA256 of the raw body in X-Shopify-Hmac-Sha256 */
export async function verifyShopifyHmacAsync(
  rawBody: string,
  hmacHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!hmacHeader || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = bufferToBase64(sig);
  return timingSafeEqualString(hmacHeader, computed);
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

type ShopifyOrderPayload = {
  id?: number | string;
  email?: string;
  contact_email?: string;
  created_at?: string;
  processed_at?: string;
  tags?: string;
  customer?: { id?: number | string; email?: string; tags?: string };
  line_items?: ShopifyLineItemLike[];
};

export function buildOrderSnapshot(order: ShopifyOrderPayload): OrderSnapshot | null {
  const email = String(order.email || order.contact_email || order.customer?.email || "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return null;

  const lineItems = order.line_items ?? [];
  const productIds = mapLineItemsToProductIds(lineItems);
  const tagStr = `${order.tags ?? ""} ${order.customer?.tags ?? ""}`;
  const tags = tagStr
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const accessTier = resolveAccessTier(productIds, tags);
  const orderedAt = order.processed_at || order.created_at || new Date().toISOString();
  const customerId =
    order.customer?.id != null ? String(order.customer.id) : null;

  return {
    orderId: order.id != null ? String(order.id) : null,
    email,
    customerId,
    tags,
    lineItems,
    productIds,
    accessTier,
    orderedAt,
    restockEstimates: estimateRestock(productIds, lineItems, orderedAt),
  };
}

export function appOriginFromEnv(requestUrl?: string): string {
  const fromEnv = (process.env["APP_ORIGIN"] ?? "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (requestUrl) {
    try {
      const u = new URL(requestUrl);
      return u.origin;
    } catch {
      /* ignore */
    }
  }
  return "https://soldiers-performance.lovable.app";
}

// Prefer service_role; log loudly if missing (do not silently use anon for entitlements).
async function adminDb() {
  if (process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  }
  console.error("SUPABASE_SERVICE_ROLE_KEY missing — admin DB unavailable");
  return null;
}

export async function upsertDeviceEntitlementAdmin(opts: {
  deviceId: string;
  email: string;
  shopifyCustomerId?: string | null;
  orderCount?: number;
  accessTier?: "base" | "performance";
  productIds?: string[];
}): Promise<boolean> {
  const db = await adminDb();
  if (!db) return false;
  const now = new Date().toISOString();
  const { error } = await db.from("app_entitlements").upsert(
    {
      device_id: opts.deviceId,
      email: opts.email.trim().toLowerCase(),
      shopify_customer_id: opts.shopifyCustomerId ?? null,
      order_count: opts.orderCount ?? 1,
      granted_at: now,
      updated_at: now,
      last_synced_at: now,
      source: "shopify_order",
      access_tier: opts.accessTier ?? "base",
      product_ids: opts.productIds ?? [],
    },
    { onConflict: "device_id" },
  );
  if (error) {
    console.error("upsertDeviceEntitlementAdmin failed", error);
    return false;
  }
  return true;
}

export async function upsertEntitlementEmail(opts: {
  snapshot: OrderSnapshot;
  magicTokenPlain: string;
  magicExpiresAt: string;
}): Promise<{ magicUrl: string }> {
  const db = await adminDb();
  if (!db) throw new Error("db");
  const hash = await sha256Hex(opts.magicTokenPlain);
  const now = new Date().toISOString();
  // Persist entitlement without derived restock — SoT is customer_profiles.restock_estimates
  // (and orders.raw_snapshot for raw Shopify). Keep restock on in-memory snapshot for access bootstrap.
  const { restockEstimates: _omitRestock, ...snapshotForStore } = opts.snapshot;
  void _omitRestock;
  const { error } = await db.from("app_entitlement_emails").upsert(
    {
      email: opts.snapshot.email,
      shopify_customer_id: opts.snapshot.customerId,
      order_snapshot: JSON.parse(JSON.stringify(snapshotForStore)) as import("@/integrations/supabase/types").Json,
      magic_token_hash: hash,
      magic_expires_at: opts.magicExpiresAt,
      last_order_at: opts.snapshot.orderedAt,
      access_tier: opts.snapshot.accessTier,
      product_ids: opts.snapshot.productIds,
      updated_at: now,
    },
    { onConflict: "email" },
  );
  if (error) {
    console.error("upsertEntitlementEmail failed", error);
    throw new Error("db");
  }
  return { magicUrl: "" };
}

export async function findEntitlementByMagicToken(token: string): Promise<{
  email: string;
  customerId: string | null;
  productIds: string[];
  accessTier: AccessTier;
  orderCount: number;
  snapshot: OrderSnapshot | null;
} | null> {
  const db = await adminDb();
  if (!db) return null;
  const hash = await sha256Hex(token.trim());
  const { data, error } = await db
    .from("app_entitlement_emails")
    .select("email, shopify_customer_id, product_ids, access_tier, order_snapshot, magic_expires_at")
    .eq("magic_token_hash", hash)
    .maybeSingle();
  if (error || !data) return null;
  if (data.magic_expires_at && new Date(data.magic_expires_at).getTime() < Date.now()) {
    return null;
  }
  const snapshot = (data.order_snapshot as OrderSnapshot | null) ?? null;
  return {
    email: data.email,
    customerId: data.shopify_customer_id ?? null,
    productIds: (data.product_ids as string[]) ?? snapshot?.productIds ?? [],
    accessTier: (data.access_tier as AccessTier) ?? "base",
    orderCount: 1,
    snapshot,
  };
}

export async function findEntitlementByEmail(email: string): Promise<{
  email: string;
  customerId: string | null;
  productIds: string[];
  accessTier: AccessTier;
  snapshot: OrderSnapshot | null;
  lastOrderAt: string | null;
} | null> {
  const db = await adminDb();
  if (!db) return null;
  const { data, error } = await db
    .from("app_entitlement_emails")
    .select("email, shopify_customer_id, product_ids, access_tier, order_snapshot, last_order_at")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  const snapshot = (data.order_snapshot as OrderSnapshot | null) ?? null;
  return {
    email: data.email,
    customerId: data.shopify_customer_id ?? null,
    productIds: (data.product_ids as string[]) ?? snapshot?.productIds ?? [],
    accessTier: (data.access_tier as AccessTier) ?? "base",
    snapshot,
    lastOrderAt: (data.last_order_at as string | null) ?? snapshot?.orderedAt ?? null,
  };
}

export async function insertEngagementEvent(opts: {
  deviceId: string;
  kind: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await adminDb();
    if (!db) return;
    await db.from("engagement_events").insert({
      device_id: opts.deviceId,
      name: opts.kind,
      props: (opts.payload ?? {}) as import("@/integrations/supabase/types").Json,
    });
  } catch (e) {
    console.warn("engagement_events insert skipped", e);
  }
}

export type GrantedAccessProfile = {
  granted: true;
  email: string;
  customerId: string | null;
  productIds: string[];
  accessTier: AccessTier;
  orderCount: number;
  restockEstimates: Record<string, RestockEstimate>;
  lastPaidAt: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerTags: string[];
};

export type DeniedAccessProfile = {
  granted: false;
  email: string;
  reason: "no_purchase" | "stale_purchase" | "not_configured";
  lastPaidAt: string | null;
};

export type AccessInspection = GrantedAccessProfile | DeniedAccessProfile;

function shopifyConfigured(): boolean {
  const domain = (process.env["SHOPIFY_STORE_DOMAIN"] ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const token = process.env["SHOPIFY_ADMIN_ACCESS_TOKEN"] ?? "";
  return Boolean(domain && token);
}

/**
 * Lookup Shopify customer by the account email (Admin search — not a full dump).
 * Access only if there is a paid order in the last 40 days.
 * Entitlement fallback does not grant if last_order_at is missing or older than 40 days.
 */
export async function inspectAccessForEmail(email: string): Promise<AccessInspection> {
  const { isPurchaseWithinWindow, latestPaidAt } = await import("@/lib/access-window");
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return { granted: false, email: normalized, reason: "no_purchase", lastPaidAt: null };
  }

  const row = await findEntitlementByEmail(normalized);

  if (shopifyConfigured()) {
    try {
      const { fetchPaidOrdersByEmailServer, fetchShopifyCustomerServer } = await import(
        "@/lib/shopify-orders.server"
      );
      const { orders, customerId } = await fetchPaidOrdersByEmailServer(normalized);
      const lastPaidAt = latestPaidAt(orders) ?? row?.lastOrderAt ?? null;
      if (orders.length > 0 && lastPaidAt && isPurchaseWithinWindow(lastPaidAt)) {
        const sorted = [...orders].sort((a, b) => {
          const ta = new Date(a.processed_at || a.created_at || 0).getTime();
          const tb = new Date(b.processed_at || b.created_at || 0).getTime();
          return tb - ta;
        });
        const latest = sorted[0]!;
        const allItems = orders.flatMap((o) => o.line_items ?? []);
        const productIds = mapLineItemsToProductIds(allItems);
        const tagStr = `${latest.tags ?? ""} ${latest.customer?.tags ?? ""}`;
        const tags = tagStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const accessTier = resolveAccessTier(productIds, tags);
        const cid = customerId ?? row?.customerId ?? null;
        let firstName: string | null = null;
        let lastName: string | null = null;
        let customerTags = tags;
        if (cid) {
          const customer = await fetchShopifyCustomerServer(cid);
          if (customer) {
            firstName = customer.firstName;
            lastName = customer.lastName;
            if (customer.tags.length) customerTags = customer.tags;
          }
        }
        return {
          granted: true,
          email: normalized,
          customerId: cid,
          productIds,
          accessTier,
          orderCount: orders.length,
          restockEstimates: estimateRestock(productIds, latest.line_items ?? [], lastPaidAt),
          lastPaidAt,
          customerFirstName: firstName,
          customerLastName: lastName,
          customerTags,
        };
      }
      if (lastPaidAt && !isPurchaseWithinWindow(lastPaidAt)) {
        return { granted: false, email: normalized, reason: "stale_purchase", lastPaidAt };
      }
      if (orders.length === 0 && row?.lastOrderAt && isPurchaseWithinWindow(row.lastOrderAt)) {
        return grantFromEntitlementRow(normalized, row);
      }
      if (orders.length === 0 && row?.lastOrderAt) {
        return {
          granted: false,
          email: normalized,
          reason: "stale_purchase",
          lastPaidAt: row.lastOrderAt,
        };
      }
      return { granted: false, email: normalized, reason: "no_purchase", lastPaidAt };
    } catch (e) {
      console.warn("inspectAccessForEmail Admin fetch failed", e);
    }
  }

  if (row?.lastOrderAt && isPurchaseWithinWindow(row.lastOrderAt)) {
    return grantFromEntitlementRow(normalized, row);
  }
  if (row?.lastOrderAt) {
    return {
      granted: false,
      email: normalized,
      reason: "stale_purchase",
      lastPaidAt: row.lastOrderAt,
    };
  }
  if (!shopifyConfigured() && !row) {
    return { granted: false, email: normalized, reason: "not_configured", lastPaidAt: null };
  }
  return { granted: false, email: normalized, reason: "no_purchase", lastPaidAt: null };
}

function grantFromEntitlementRow(
  email: string,
  row: NonNullable<Awaited<ReturnType<typeof findEntitlementByEmail>>>,
): GrantedAccessProfile {
  return {
    granted: true,
    email,
    customerId: row.customerId,
    productIds: row.productIds,
    accessTier: row.accessTier,
    orderCount: 1,
    restockEstimates: row.snapshot?.restockEstimates ?? {},
    lastPaidAt: row.lastOrderAt ?? new Date().toISOString(),
    customerFirstName: null,
    customerLastName: null,
    customerTags: [],
  };
}

/**
 * Server-authoritative purchase profile for an email.
 * Never trust client-sent tier/productIds — always resolve from entitlement row + Shopify Admin.
 * Returns null when there is no paid order in the last 40 days.
 */
export async function resolveAccessProfileForEmail(email: string): Promise<GrantedAccessProfile | null> {
  const inspected = await inspectAccessForEmail(email);
  return inspected.granted ? inspected : null;
}

