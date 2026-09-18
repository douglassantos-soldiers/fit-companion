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
  const { error } = await db.from("app_entitlement_emails").upsert(
    {
      email: opts.snapshot.email,
      shopify_customer_id: opts.snapshot.customerId,
      order_snapshot: JSON.parse(JSON.stringify(opts.snapshot)) as import("@/integrations/supabase/types").Json,
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
} | null> {
  const db = await adminDb();
  if (!db) return null;
  const { data, error } = await db
    .from("app_entitlement_emails")
    .select("email, shopify_customer_id, product_ids, access_tier, order_snapshot")
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
