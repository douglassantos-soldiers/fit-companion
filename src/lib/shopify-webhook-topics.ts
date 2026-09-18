/**
 * Pure topic routing helpers for Shopify webhooks (unit-testable).
 */

export function normalizeWebhookTopic(topic: string | null | undefined): string {
  return String(topic ?? "").trim().toLowerCase();
}

export function isCustomerTopic(topic: string): boolean {
  return normalizeWebhookTopic(topic).startsWith("customers/");
}

export function isRefundTopic(topic: string): boolean {
  return normalizeWebhookTopic(topic).startsWith("refunds/");
}

export function isOrderTopic(topic: string): boolean {
  const t = normalizeWebhookTopic(topic);
  return t.startsWith("orders/") || t === "orders/paid" || t === "orders/create" || t === "orders/updated";
}

/** Idempotency hash input contract: `${topic}:${rawBody}` */
export function webhookPayloadHashInput(topic: string, rawBody: string): string {
  return `${normalizeWebhookTopic(topic)}:${rawBody}`;
}
