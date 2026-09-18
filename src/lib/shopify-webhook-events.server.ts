/**
 * Idempotency for Shopify webhooks.
 */
import { adminDbLoose } from "@/lib/db-admin";

/** Returns true if this event should be processed (first time). False if duplicate. */
export async function claimWebhookEvent(opts: {
  webhookId: string | null;
  topic: string;
  shopDomain: string | null;
  payloadHash: string;
}): Promise<boolean> {
  const db = await adminDbLoose();
  if (!db) return true; // fail-open if no admin db (dev)

  if (opts.webhookId) {
    const { data: byId } = await db
      .from("shopify_webhook_events")
      .select("id")
      .eq("webhook_id", opts.webhookId)
      .maybeSingle();
    if (byId) return false;
  }

  const { data: byHash } = await db
    .from("shopify_webhook_events")
    .select("id")
    .eq("payload_hash", opts.payloadHash)
    .maybeSingle();
  if (byHash) return false;

  const { error } = await db.from("shopify_webhook_events").insert({
    webhook_id: opts.webhookId,
    topic: opts.topic,
    shop_domain: opts.shopDomain,
    payload_hash: opts.payloadHash,
  });

  if (error) {
    if (error.code === "23505") return false;
    console.warn("claimWebhookEvent insert failed", error);
    return true;
  }
  return true;
}
