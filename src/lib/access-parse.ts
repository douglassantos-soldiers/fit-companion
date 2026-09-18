/**
 * Pure validators for access session (no server/cookie imports).
 * Safe to use from unit tests.
 */

/** Public validator — strips client-sent tier/productIds/orderCount. */
export function parseEstablishAccessInput(input: unknown): { email: string; deviceId: string } {
  const v = input as {
    email?: string;
    deviceId?: string;
    /** @deprecated ignored — server recalculates */
    accessTier?: string;
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
    deviceId: String(v?.deviceId ?? "").trim(),
  };
}
