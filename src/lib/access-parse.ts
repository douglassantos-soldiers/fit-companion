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

export function parseCompleteAccountInput(input: unknown): {
  email: string;
  deviceId: string;
  authUserId: string;
  displayName: string;
  isNewUser: boolean;
} {
  const v = input as {
    email?: string;
    deviceId?: string;
    authUserId?: string;
    displayName?: string;
    isNewUser?: boolean;
  } | null;
  const email = String(v?.email ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido");
  return {
    email,
    deviceId: String(v?.deviceId ?? "").trim(),
    authUserId: String(v?.authUserId ?? "").trim(),
    displayName: String(v?.displayName ?? "").trim().slice(0, 80),
    isNewUser: v?.isNewUser === true,
  };
}

export function parseAdminLogin(input: unknown): { email: string; password: string } {
  const v = input as { email?: string; password?: string; pin?: string } | null;
  const email = String(v?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(v?.password ?? v?.pin ?? "");
  if (!email.includes("@")) throw new Error("E-mail inválido");
  if (!password) throw new Error("Senha ausente");
  return { email, password };
}
