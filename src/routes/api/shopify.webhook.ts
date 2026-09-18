import { createFileRoute } from "@tanstack/react-router";

/**
 * Shopify webhooks (HMAC validated):
 * - customers/create, customers/update
 * - orders/create, orders/paid, orders/updated
 * - refunds/create
 *
 * Configure in Admin → Settings → Notifications → Webhooks
 * URL: {APP_ORIGIN}/api/shopify/webhook
 */
export const Route = createFileRoute("/api/shopify/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const hmac = request.headers.get("X-Shopify-Hmac-Sha256");
        const topic = (request.headers.get("X-Shopify-Topic") ?? "orders/paid").toLowerCase();
        const webhookId = request.headers.get("X-Shopify-Webhook-Id");
        const shopDomain = request.headers.get("X-Shopify-Shop-Domain");
        const secret = process.env["SHOPIFY_WEBHOOK_SECRET"] ?? "";

        const {
          verifyShopifyHmacAsync,
          buildOrderSnapshot,
          upsertEntitlementEmail,
          appOriginFromEnv,
          sha256Hex,
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

        // Idempotency
        const payloadHash = await sha256Hex(`${topic}:${rawBody}`);
        const { claimWebhookEvent } = await import("@/lib/shopify-webhook-events.server");
        const claimed = await claimWebhookEvent({
          webhookId,
          topic,
          shopDomain,
          payloadHash,
        });
        if (!claimed) {
          return Response.json({ ok: true, duplicate: true });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return new Response("bad json", { status: 400 });
        }

        if (topic.startsWith("customers/")) {
          await handleCustomerTopic(topic, payload);
          return Response.json({ ok: true, topic });
        }

        if (topic.startsWith("refunds/")) {
          await handleRefundTopic(payload);
          return Response.json({ ok: true, topic });
        }

        // orders/*
        const snapshot = buildOrderSnapshot(payload as Parameters<typeof buildOrderSnapshot>[0]);
        if (!snapshot) {
          console.info("Shopify webhook: no email on order, ack");
          return Response.json({ ok: true, skipped: "no_email", topic });
        }

        const { resolveOrCreateUserByEmail, linkShopifyIdentity } = await import("@/lib/identity");
        const { upsertShopifyOrder } = await import("@/lib/orders.server");
        const { trackUserEvent } = await import("@/lib/events/track");
        const { recomputeCustomerProfile } = await import("@/lib/customer360/recompute.server");

        const user = await resolveOrCreateUserByEmail(snapshot.email);
        if (user && snapshot.customerId) {
          await linkShopifyIdentity({
            userId: user.id,
            shopifyCustomerId: snapshot.customerId,
            externalEmail: snapshot.email,
          });
        }

        const orderPayload: import("@/lib/shopify.server").OrderSnapshot & {
          financial_status?: string;
          total?: number;
          currency?: string;
        } = {
          orderId: snapshot.orderId,
          email: snapshot.email,
          customerId: snapshot.customerId,
          tags: snapshot.tags,
          lineItems: snapshot.lineItems,
          productIds: snapshot.productIds,
          accessTier: snapshot.accessTier,
          orderedAt: snapshot.orderedAt,
          restockEstimates: snapshot.restockEstimates,
          financial_status: topic.includes("paid")
            ? "paid"
            : String(payload["financial_status"] ?? "pending"),
          currency: String(payload["currency"] ?? "BRL"),
        };
        if (payload["total_price"] != null) {
          orderPayload.total = Number(payload["total_price"]);
        }
        await upsertShopifyOrder({
          userId: user?.id ?? null,
          order: orderPayload,
        });

        // Access entitlement only on paid (and create/update when already paid)
        const financial = String(payload["financial_status"] ?? "").toLowerCase();
        const isPaid =
          topic === "orders/paid" || financial === "paid" || financial === "partially_paid";

        if (isPaid) {
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
          );

          if (snapshot.orderId) {
            void stampOrderMagicUrl(snapshot.orderId, magicUrl).catch((err) =>
              console.warn("stamp order note failed", err),
            );
          }

          const purchaseEvent: import("@/lib/events/track").TrackUserEventInput = {
            eventType: "purchase",
            source: "shopify_webhook",
            payload: {
              orderId: snapshot.orderId,
              productIds: snapshot.productIds,
              topic,
            },
            idempotencyKey: `purchase:${snapshot.orderId ?? payloadHash}`,
          };
          if (user?.id) purchaseEvent.userId = user.id;
          await trackUserEvent(purchaseEvent);
        }

        if (user) {
          void recomputeCustomerProfile(user.id).catch(() => undefined);
        }

        return Response.json({
          ok: true,
          topic,
          email: snapshot.email,
          productIds: snapshot.productIds,
        });
      },
    },
  },
});

async function handleCustomerTopic(topic: string, payload: Record<string, unknown>) {
  const email = String(payload["email"] ?? "")
    .trim()
    .toLowerCase();
  const customerId = payload["id"] != null ? String(payload["id"]) : null;
  if (!email.includes("@") && !customerId) return;

  const { resolveOrCreateUserByEmail, linkShopifyIdentity, findUserByShopifyCustomerId } =
    await import("@/lib/identity");

  let user = email.includes("@") ? await resolveOrCreateUserByEmail(email) : null;
  if (!user && customerId) {
    user = await findUserByShopifyCustomerId(customerId);
  }
  if (user && customerId) {
    await linkShopifyIdentity({
      userId: user.id,
      shopifyCustomerId: customerId,
      externalEmail: email.includes("@") ? email : null,
    });
  }
  void topic;
}

async function handleRefundTopic(payload: Record<string, unknown>) {
  const orderId =
    payload["order_id"] != null
      ? String(payload["order_id"])
      : (payload["order"] as { id?: unknown } | undefined)?.id != null
        ? String((payload["order"] as { id: unknown }).id)
        : null;
  if (!orderId) return;

  const { markOrderRefunded } = await import("@/lib/orders.server");
  await markOrderRefunded(orderId);

  const { trackUserEvent } = await import("@/lib/events/track");
  await trackUserEvent({
    eventType: "refund",
    source: "shopify_webhook",
    payload: { shopifyOrderId: orderId },
    idempotencyKey: `refund:${orderId}:${String(payload["id"] ?? "")}`,
  });
}

async function stampOrderMagicUrl(orderId: string, magicUrl: string): Promise<void> {
  const domain = (process.env["SHOPIFY_STORE_DOMAIN"] ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const token = process.env["SHOPIFY_ADMIN_ACCESS_TOKEN"] ?? "";
  const version = process.env["SHOPIFY_API_VERSION"] ?? "2025-01";
  if (!domain || !token) return;

  // Fetch existing note_attributes to avoid wiping other attrs
  let existing: Array<{ name: string; value: string }> = [];
  try {
    const getRes = await fetch(`https://${domain}/admin/api/${version}/orders/${orderId}.json`, {
      headers: { "X-Shopify-Access-Token": token },
    });
    if (getRes.ok) {
      const json = (await getRes.json()) as {
        order?: { note_attributes?: Array<{ name?: string; value?: string }> };
      };
      existing = (json.order?.note_attributes ?? [])
        .filter((a) => a.name && a.name !== "companion_access_url")
        .map((a) => ({ name: String(a.name), value: String(a.value ?? "") }));
    }
  } catch {
    /* best-effort */
  }

  const res = await fetch(`https://${domain}/admin/api/${version}/orders/${orderId}.json`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      order: {
        id: orderId,
        note_attributes: [
          ...existing,
          { name: "companion_access_url", value: magicUrl },
        ],
      },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.warn("stampOrderMagicUrl", res.status, t.slice(0, 120));
  }
}
