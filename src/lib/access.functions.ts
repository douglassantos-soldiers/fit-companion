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
  authenticateAdminWithRole,
} from "@/lib/access-session.server";
import {
  parseEstablishAccessInput,
  parseAdminLogin,
  parseCompleteAccountInput,
} from "@/lib/access-parse";

export {
  parseEstablishAccessInput,
  parseAdminLogin,
  parseCompleteAccountInput,
} from "@/lib/access-parse";

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
    const { inspectAccessForEmail, upsertDeviceEntitlementAdmin, findEntitlementByEmail } =
      await import("@/lib/shopify.server");
    const { resolveOrCreateUserByEmail, linkDeviceToShopifyUser } = await import("@/lib/identity");
    const { upsertOrdersFromPaidList } = await import("@/lib/orders.server");
    const { accessExpiresAtIso } = await import("@/lib/access-window");
    const { shopifyDisplayName } = await import("@/lib/shopify-orders.server");

    // P0-10: client cannot create entitlement — require pre-existing email grant (webhook/admin)
    const prior = await findEntitlementByEmail(data.email);
    if (!prior) {
      return { ok: false as const, reason: "no_entitlement" as const };
    }

    const inspected = await inspectAccessForEmail(data.email);
    if (!inspected.granted) {
      return { ok: false as const, reason: inspected.reason };
    }
    const profile = inspected;

    const appUser = await resolveOrCreateUserByEmail(data.email);
    if (!appUser) {
      return { ok: false as const, reason: "no_entitlement" as const };
    }
    let userId: string = appUser.id;

    // Attach device to existing grant only — never upsertEntitlementEmail from client path
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
        try {
          const { writeAudit } = await import("@/lib/admin.server");
          await writeAudit(
            "entitlement_device_attach",
            {
              email: data.email,
              deviceId: data.deviceId,
              resource_type: "app_entitlements",
              resource_id: data.deviceId,
            },
            data.email,
          );
        } catch {
          /* audit best-effort */
        }
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

    setAccessSessionCookie({
      email: data.email,
      tier: profile.accessTier,
      userId,
      lastPaidAt: profile.lastPaidAt,
    });

    try {
      const { writeAudit } = await import("@/lib/admin.server");
      await writeAudit(
        "access_session_establish",
        { email: data.email, userId, deviceId: data.deviceId ?? null },
        data.email,
      );
    } catch {
      /* best-effort */
    }

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
    const { inspectAccessForEmail, findEntitlementByEmail } = await import("@/lib/shopify.server");
    const { linkDeviceToShopifyUser, linkAuthUserId, resolveOrCreateUserByEmail } =
      await import("@/lib/identity");
    const { trackUserEvent } = await import("@/lib/events/track");

    // Require pre-existing entitlement before linking device (P0-10 / P0-9)
    const prior = await findEntitlementByEmail(data.email);
    if (!prior) {
      return {
        ok: false as const,
        reason: "no_entitlement" as const,
        lastPaidAt: null,
        userId: null,
      };
    }

    const inspected = await inspectAccessForEmail(data.email);
    if (!inspected.granted) {
      return {
        ok: false as const,
        reason: inspected.reason,
        lastPaidAt: inspected.lastPaidAt,
        userId: null,
      };
    }

    const appUser = data.deviceId
      ? await linkDeviceToShopifyUser({ deviceId: data.deviceId, email: data.email })
      : await resolveOrCreateUserByEmail(data.email);
    if (!appUser) {
      return { ok: false as const, reason: "invalid" as const, lastPaidAt: null, userId: null };
    }

    // Never trust client authUserId — resolve from Auth session cookies if present
    void data.authUserId;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
      const anon =
        process.env["SUPABASE_PUBLISHABLE_KEY"] ||
        process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
        "";
      if (url && anon) {
        const { getCookie } = await import("@tanstack/react-start/server");
        const accessToken = getCookie("sb-access-token") || getCookie("sb-auth-token");
        if (accessToken) {
          const client = createClient(url, anon, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: auth } = await client.auth.getUser();
          if (auth.user?.id) {
            await linkAuthUserId({ userId: appUser.id, authUserId: auth.user.id });
          }
        }
      }
    } catch (e) {
      console.warn("completeAccountAccess auth link skipped", e);
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
    const result = await authenticateAdminWithRole(data.email, data.password);
    if (result.ok) {
      setAdminSessionCookie(data.email, result.role);
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
      return {
        ok: true as const,
        email: data.email,
        tier: "performance" as const,
        role: result.role,
      };
    }
    return { ok: false as const, reason: result.reason };
  });

export const checkAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: readAdminSession() };
});

export const logoutAdmin = createServerFn({ method: "POST" }).handler(async () => {
  clearAdminSessionCookie();
  return { ok: true as const };
});
