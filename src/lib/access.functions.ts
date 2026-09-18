/**
 * Server-authoritative access session.
 * Client may send email + deviceId only — tier/products/orderCount are NEVER trusted from client.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  clearAccessSessionCookie,
  readAccessSession,
  setAccessSessionCookie,
  setAdminSessionCookie,
  readAdminSession,
  rateLimitKey,
} from "@/lib/access-session.server";
import { parseEstablishAccessInput } from "@/lib/access-parse";

export { parseEstablishAccessInput } from "@/lib/access-parse";

export const checkAccessSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = readAccessSession();
  if (!session) return { ok: false as const };
  return {
    ok: true as const,
    email: session.email,
    tier: session.tier,
    userId: session.userId ?? null,
  };
});

export const clearAccessSession = createServerFn({ method: "POST" }).handler(async () => {
  clearAccessSessionCookie();
  return { ok: true as const };
});

export const establishAccessSession = createServerFn({ method: "POST" })
  .inputValidator(parseEstablishAccessInput)
  .handler(async ({ data }) => {
    const {
      resolveAccessProfileForEmail,
      upsertDeviceEntitlementAdmin,
      upsertEntitlementEmail,
      buildOrderSnapshot,
    } = await import("@/lib/shopify.server");
    const { resolveOrCreateUserByEmail, linkDeviceToShopifyUser } = await import("@/lib/identity");
    const { upsertOrdersFromPaidList } = await import("@/lib/orders.server");

    const profile = await resolveAccessProfileForEmail(data.email);
    if (!profile) {
      return { ok: false as const, reason: "no_entitlement" as const };
    }

    // Always resolve app user by email BEFORE cookie (identity is user, not device)
    const appUser = await resolveOrCreateUserByEmail(data.email);
    if (!appUser) {
      return { ok: false as const, reason: "no_entitlement" as const };
    }
    let userId: string = appUser.id;

    // Persist entitlement email snapshot for future resolves (best-effort)
    try {
      const magicToken = crypto.randomUUID();
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      await upsertEntitlementEmail({
        snapshot: {
          orderId: null,
          email: data.email,
          customerId: profile.customerId,
          tags: [],
          lineItems: [],
          productIds: profile.productIds,
          accessTier: profile.accessTier,
          orderedAt: new Date().toISOString(),
          restockEstimates: profile.restockEstimates,
        },
        magicTokenPlain: magicToken,
        magicExpiresAt: expires.toISOString(),
      });
      void buildOrderSnapshot;
    } catch (e) {
      console.warn("establishAccessSession entitlement email upsert skipped", e);
    }

    if (data.deviceId) {
      try {
        await upsertDeviceEntitlementAdmin({
          deviceId: data.deviceId,
          email: data.email,
          shopifyCustomerId: profile.customerId,
          orderCount: profile.orderCount,
          accessTier: profile.accessTier,
          productIds: profile.productIds,
        });
      } catch (e) {
        console.error("establishAccessSession entitlement upsert failed", e);
      }

      try {
        const user = await linkDeviceToShopifyUser({
          deviceId: data.deviceId,
          email: data.email,
          shopifyCustomerId: profile.customerId,
        });
        if (user?.id) userId = user.id;
      } catch (e) {
        console.error("establishAccessSession identity link failed", e);
      }
    } else if (profile.customerId) {
      const { linkShopifyIdentity } = await import("@/lib/identity");
      await linkShopifyIdentity({
        userId,
        shopifyCustomerId: profile.customerId,
        externalEmail: data.email,
      });
    }

    try {
      const { fetchPaidOrdersByEmailServer } = await import("@/lib/shopify-orders.server");
      const { orders } = await fetchPaidOrdersByEmailServer(data.email);
      await upsertOrdersFromPaidList({ userId, orders });
    } catch (e) {
      console.warn("establishAccessSession order sync skipped", e);
    }

    void import("@/lib/customer360/recompute.server")
      .then(({ recomputeCustomerProfile }) => recomputeCustomerProfile(userId))
      .catch((e) => console.warn("recomputeCustomerProfile skipped", e));

    // Cookie ALWAYS includes userId after access
    setAccessSessionCookie({
      email: data.email,
      tier: profile.accessTier,
      userId,
    });

    return {
      ok: true as const,
      email: data.email,
      tier: profile.accessTier,
      productIds: profile.productIds,
      shopifyCustomerId: profile.customerId,
      orderCount: profile.orderCount,
      restockEstimates: profile.restockEstimates,
      userId,
    };
  });

function parseAdminPin(input: unknown) {
  const pin = String((input as { pin?: string } | null)?.pin ?? "");
  if (!pin) throw new Error("PIN ausente");
  return { pin };
}

export const loginAdmin = createServerFn({ method: "POST" })
  .inputValidator(parseAdminPin)
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PIN"] || "";
    if (!expected) {
      console.error("ADMIN_PIN not configured");
      return { ok: false as const, reason: "not_configured" as const };
    }
    if (!rateLimitKey(`admin:${data.pin.slice(0, 2)}`, 8, 15 * 60_000)) {
      return { ok: false as const, reason: "rate_limited" as const };
    }
    if (data.pin !== expected) return { ok: false as const, reason: "invalid" as const };
    setAdminSessionCookie();
    return { ok: true as const };
  });

export const checkAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: readAdminSession() };
});
