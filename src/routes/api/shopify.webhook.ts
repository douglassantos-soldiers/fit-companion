import { createFileRoute } from "@tanstack/react-router";

/**
 * Shopify webhook: orders/paid
 * Configure in Admin → Settings → Notifications → Webhooks
 * URL: {APP_ORIGIN}/api/shopify/webhook
 */
export const Route = createFileRoute("/api/shopify/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const hmac = request.headers.get("X-Shopify-Hmac-Sha256");
        const secret = process.env["SHOPIFY_WEBHOOK_SECRET"] ?? "";

        const {
          verifyShopifyHmacAsync,
          buildOrderSnapshot,
          upsertEntitlementEmail,
          appOriginFromEnv,
        } = await import("@/lib/shopify.server");

        if (!secret) {
          console.error("SHOPIFY_WEBHOOK_SECRET missing");
          return new Response("not configured", { status: 503 });
        }

        const ok = await verifyShopifyHmacAsync(rawBody, hmac, secret);
        if (!ok) {
          console.warn("Shopify webhook HMAC invalid");
          return new Response("invalid hmac", { status: 401 });
        }

        let order: unknown;
        try {
          order = JSON.parse(rawBody);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const snapshot = buildOrderSnapshot(order as Parameters<typeof buildOrderSnapshot>[0]);
        if (!snapshot) {
          console.info("Shopify webhook: no email on order, ack");
          return Response.json({ ok: true, skipped: "no_email" });
        }

        const magicToken = crypto.randomUUID();
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);

        try {
          await upsertEntitlementEmail({
            snapshot,
            magicTokenPlain: magicToken,
            magicExpiresAt: expires.toISOString(),
          });
        } catch (e) {
          console.error("Shopify webhook persist failed", e);
          return new Response("db error", { status: 500 });
        }

        const origin = appOriginFromEnv(request.url);
        const magicUrl = `${origin}/acesso?token=${encodeURIComponent(magicToken)}`;
        console.info(
          "Shopify webhook: entitlement ready",
          snapshot.email.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
          "products=",
          snapshot.productIds.join(","),
          "url=",
          magicUrl,
        );

        // Best-effort: stamp order note attribute for email/Flow Liquid
        if (snapshot.orderId) {
          void stampOrderMagicUrl(snapshot.orderId, magicUrl).catch((err) =>
            console.warn("stamp order note failed", err),
          );
        }

        return Response.json({ ok: true, email: snapshot.email, productIds: snapshot.productIds });
      },
    },
  },
});

async function stampOrderMagicUrl(orderId: string, magicUrl: string): Promise<void> {
  const domain = (process.env["SHOPIFY_STORE_DOMAIN"] ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const token = process.env["SHOPIFY_ADMIN_ACCESS_TOKEN"] ?? "";
  const version = process.env["SHOPIFY_API_VERSION"] ?? "2025-01";
  if (!domain || !token) return;

  const res = await fetch(`https://${domain}/admin/api/${version}/orders/${orderId}.json`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      order: {
        id: orderId,
        note_attributes: [{ name: "companion_access_url", value: magicUrl }],
      },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.warn("stampOrderMagicUrl", res.status, t.slice(0, 120));
  }
}
