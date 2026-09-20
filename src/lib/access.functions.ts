/**
 * Server-authoritative access session.
 * Client may send email + deviceId only — tier/products/orderCount are NEVER trusted from client.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  clearAccessSessionCookie,
  clearAdminSessionCookie,
  readAccessSession,
  setAccessSessionCookie,
  setAdminSessionCookie,
  readAdminSession,
  readAppAccessSession,
  rateLimitKey,
  authenticateAdmin,
} from "@/lib/access-session.server";
import { parseEstablishAccessInput, parseAdminLogin, parseCompleteAccountInput } from "@/lib/access-parse";

export { parseEstablishAccessInput, parseAdminLogin, parseCompleteAccountInput } from "@/lib/access-parse";

export const checkAccessSession = createServerFn({ method: "GET" }).handler(async () => {
  let session = readAccessSession();
  if (!session) {
    const admin = readAppAccessSession();
    if (admin) {
      try {
        const { resolveOrCreateUserByEmail } = await import("@/lib/identity");
        const user = await resolveOrCreateUserByEmail(admin.email);
        if (user) {
          setAccessSessionCookie({
            email: admin.email,
            tier: "performance",
            userId: user.id,
          });
          session = {
            email: admin.email,
            tier: "performance",
            exp: admin.exp,
            userId: user.id,
          };
        } else {
          session = admin;
        }
      } catch (e) {
        console.warn("admin access bootstrap failed", e);
        session = admin;
      }
    }
  }
  if (!session) return { ok: false as const };
  if (session.lastPaidAt) {
    const { isPurchaseWithinWindow } = await import("@/lib/access-window");
    if (!isPurchaseWithinWindow(session.lastPaidAt)) {
      clearAccessSessionCookie();
      return { ok: false as const, reason: "stale_purchase" as const };
    }
  }
  try {
    const { isUserBlocked } = await import("@/lib/account-status.server");
    const blocked = await isUserBlocked({
      userId: session.userId ?? null,
      email: session.email,
    });
    if (blocked) return { ok: false as const, reason: "account_blocked" as const };
  } catch (e) {
    console.warn("account status check failed", e);
  }
  return {
    ok: true as const,
    email: session.email,
    tier: session.tier,
    userId: session.userId ?? null,
    lastPaidAt: session.lastPaidAt ?? null,
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
      inspectAccessForEmail,
      upsertDeviceEntitlementAdmin,
      upsertEntitlementEmail,
      buildOrderSnapshot,
    } = await import("@/lib/shopify.server");
    const { resolveOrCreateUserByEmail, linkDeviceToShopifyUser } = await import("@/lib/identity");
    const { upsertOrdersFromPaidList } = await import("@/lib/orders.server");
    const { accessExpiresAtIso } = await import("@/lib/access-window");
    const { shopifyDisplayName } = await import("@/lib/shopify-orders.server");

    const inspected = await inspectAccessForEmail(data.email);
    if (!inspected.granted) {
      return { ok: false as const, reason: inspected.reason };
    }
    const profile = inspected;

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
          tags: profile.customerTags,
          lineItems: [],
          productIds: profile.productIds,
          accessTier: profile.accessTier,
          orderedAt: profile.lastPaidAt,
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

    const displayName = shopifyDisplayName({
      firstName: profile.customerFirstName,
      lastName: profile.customerLastName,
    });

    // Cookie ALWAYS includes userId after access
    setAccessSessionCookie({
      email: data.email,
      tier: profile.accessTier,
      userId,
      lastPaidAt: profile.lastPaidAt,
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
      lastPaidAt: profile.lastPaidAt,
      accessExpiresAt: accessExpiresAtIso(profile.lastPaidAt),
      shopifyDisplayName: displayName,
    };
  });

export const completeAccountAccess = createServerFn({ method: "POST" })
  .inputValidator(parseCompleteAccountInput)
  .handler(async ({ data }) => {
    const { inspectAccessForEmail } = await import("@/lib/shopify.server");
    const { linkDeviceToShopifyUser, linkAuthUserId, resolveOrCreateUserByEmail } = await import(
      "@/lib/identity"
    );
    const { trackUserEvent } = await import("@/lib/events/track");

    const appUser = data.deviceId
      ? await linkDeviceToShopifyUser({ deviceId: data.deviceId, email: data.email })
      : await resolveOrCreateUserByEmail(data.email);
    if (!appUser) {
      return { ok: false as const, reason: "invalid" as const, lastPaidAt: null, userId: null };
    }

    if (data.authUserId) {
      await linkAuthUserId({ userId: appUser.id, authUserId: data.authUserId });
    }

    if (data.isNewUser) {
      void trackUserEvent({
        deviceId: data.deviceId || null,
        resolvedUserId: appUser.id,
        eventType: "user_created",
        source: "auth",
        metadata: { via: "email_password" },
        idempotencyKey: `user_created:${appUser.id}`,
      });
    }

    const inspected = await inspectAccessForEmail(data.email);
    if (!inspected.granted) {
      void trackUserEvent({
        deviceId: data.deviceId || null,
        resolvedUserId: appUser.id,
        eventType: "access_denied",
        source: "access",
        metadata: {
          reason: inspected.reason,
          ...(inspected.reason === "stale_purchase" ? { stale_purchase: true } : {}),
        },
      });
      return {
        ok: false as const,
        reason: inspected.reason,
        lastPaidAt: inspected.lastPaidAt,
        userId: appUser.id,
      };
    }

    const { accessExpiresAtIso } = await import("@/lib/access-window");
    const { shopifyDisplayName } = await import("@/lib/shopify-orders.server");
    const displayName = shopifyDisplayName({
      firstName: inspected.customerFirstName,
      lastName: inspected.customerLastName,
    });

    void trackUserEvent({
      deviceId: data.deviceId || null,
      resolvedUserId: appUser.id,
      eventType: "access_granted",
      source: "access",
      metadata: { via: data.isNewUser ? "signup" : "signin", windowDays: 40 },
    });

    return {
      ok: true as const,
      email: data.email,
      tier: inspected.accessTier,
      productIds: inspected.productIds,
      shopifyCustomerId: inspected.customerId,
      orderCount: inspected.orderCount,
      restockEstimates: inspected.restockEstimates,
      userId: appUser.id,
      lastPaidAt: inspected.lastPaidAt,
      accessExpiresAt: accessExpiresAtIso(inspected.lastPaidAt),
      shopifyDisplayName: displayName,
    };
  });

export const loginAdmin = createServerFn({ method: "POST" })
  .inputValidator(parseAdminLogin)
  .handler(async ({ data }) => {
    if (!rateLimitKey(`admin:${data.email}`, 8, 15 * 60_000)) {
      return { ok: false as const, reason: "rate_limited" as const };
    }
    const result = await authenticateAdmin(data.email, data.password);
    if (result === "ok") {
      setAdminSessionCookie(data.email);
      try {
        const { resolveOrCreateUserByEmail } = await import("@/lib/identity");
        const user = await resolveOrCreateUserByEmail(data.email);
        if (user) {
          setAccessSessionCookie({
            email: data.email,
            tier: "performance",
            userId: user.id,
          });
        }
      } catch (e) {
        console.warn("admin app access cookie skipped", e);
      }
      return { ok: true as const, email: data.email, tier: "performance" as const };
    }
    return { ok: false as const, reason: result };
  });

export const checkAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: readAdminSession() };
});

export const logoutAdmin = createServerFn({ method: "POST" }).handler(async () => {
  clearAdminSessionCookie();
  return { ok: true as const };
});
