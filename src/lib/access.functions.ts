import { createServerFn } from "@tanstack/react-start";
import {
  clearAccessSessionCookie,
  readAccessSession,
  setAccessSessionCookie,
  setAdminSessionCookie,
  readAdminSession,
  rateLimitKey,
} from "@/lib/access-session.server";

export const checkAccessSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = readAccessSession();
  if (!session) return { ok: false as const };
  return { ok: true as const, email: session.email, tier: session.tier };
});

export const clearAccessSession = createServerFn({ method: "POST" }).handler(async () => {
  clearAccessSessionCookie();
  return { ok: true as const };
});

function parseEstablish(input: unknown) {
  const v = input as {
    email?: string;
    accessTier?: string;
    deviceId?: string;
    shopifyCustomerId?: string | null;
    orderCount?: number;
    productIds?: string[];
  } | null;
  const email = String(v?.email ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido");
  return {
    email,
    accessTier: (v?.accessTier === "performance" ? "performance" : "base") as "base" | "performance",
    deviceId: String(v?.deviceId ?? "").trim(),
    shopifyCustomerId: v?.shopifyCustomerId ?? null,
    orderCount: typeof v?.orderCount === "number" ? v.orderCount : 1,
    productIds: Array.isArray(v?.productIds) ? v.productIds.map(String).slice(0, 12) : [],
  };
}

export const establishAccessSession = createServerFn({ method: "POST" })
  .inputValidator(parseEstablish)
  .handler(async ({ data }) => {
    setAccessSessionCookie({ email: data.email, tier: data.accessTier });
    if (data.deviceId) {
      try {
        const { upsertDeviceEntitlementAdmin } = await import("@/lib/shopify.server");
        await upsertDeviceEntitlementAdmin({
          deviceId: data.deviceId,
          email: data.email,
          shopifyCustomerId: data.shopifyCustomerId,
          orderCount: data.orderCount,
          accessTier: data.accessTier,
          productIds: data.productIds,
        });
      } catch (e) {
        console.error("establishAccessSession entitlement upsert failed", e);
      }
    }
    return { ok: true as const, email: data.email, tier: data.accessTier };
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
