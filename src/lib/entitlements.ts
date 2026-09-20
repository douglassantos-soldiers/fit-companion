/**
 * Client entitlement module — READ/WRITE via anon client is disabled (RLS + server authority).
 * Tier comes from access session / server fns only.
 */

export interface EntitlementRow {
  deviceId: string;
  email: string;
  shopifyCustomerId: string | null;
  grantedAt: string;
  orderCount: number;
  accessTier: "base" | "performance";
  productIds: string[];
}

/**
 * @deprecated Client direct read is not authoritative (RLS blocks anon).
 * Use access session / establishAccess server path instead.
 */
export async function fetchEntitlement(_deviceId: string): Promise<EntitlementRow | null> {
  return null;
}

/**
 * @deprecated Client must never write app_entitlements. Server + service_role only.
 */
export async function upsertEntitlement(_opts: {
  deviceId: string;
  email: string;
  shopifyCustomerId?: string | null;
  orderCount?: number;
  accessTier?: "base" | "performance";
  productIds?: string[];
}): Promise<EntitlementRow | null> {
  if (process.env["NODE_ENV"] !== "production") {
    console.warn("[entitlements] upsertEntitlement ignored — server authority only");
  }
  return null;
}
