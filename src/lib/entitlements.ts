import { supabase } from "@/integrations/supabase/client";

export interface EntitlementRow {
  deviceId: string;
  email: string;
  shopifyCustomerId: string | null;
  grantedAt: string;
  orderCount: number;
  accessTier: "base" | "performance";
  productIds: string[];
}

function mapRow(data: {
  device_id: string;
  email: string;
  shopify_customer_id: string | null;
  granted_at: string;
  order_count: number | null;
  access_tier: string | null;
  product_ids: string[] | null;
}): EntitlementRow {
  return {
    deviceId: data.device_id,
    email: data.email,
    shopifyCustomerId: data.shopify_customer_id ?? null,
    grantedAt: data.granted_at,
    orderCount: data.order_count ?? 1,
    accessTier: data.access_tier === "performance" ? "performance" : "base",
    productIds: Array.isArray(data.product_ids) ? data.product_ids : [],
  };
}

export async function fetchEntitlement(deviceId: string): Promise<EntitlementRow | null> {
  if (!deviceId) return null;
  const { data, error } = await supabase
    .from("app_entitlements")
    .select("device_id, email, shopify_customer_id, granted_at, order_count, access_tier, product_ids")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export async function upsertEntitlement(opts: {
  deviceId: string;
  email: string;
  shopifyCustomerId?: string | null;
  orderCount?: number;
  accessTier?: "base" | "performance";
  productIds?: string[];
}): Promise<EntitlementRow | null> {
  if (!opts.deviceId || !opts.email) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("app_entitlements")
    .upsert(
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
    )
    .select("device_id, email, shopify_customer_id, granted_at, order_count, access_tier, product_ids")
    .maybeSingle();
  if (error) {
    console.error("Falha ao gravar entitlement", error);
    return null;
  }
  if (!data) return null;
  return mapRow(data);
}
