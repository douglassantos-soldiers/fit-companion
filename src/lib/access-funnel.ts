/**
 * Shared access-funnel search + prefill helpers (welcome → auth → /acesso).
 */

export type AccessNextPath = "/" | "/onboarding";

const PREFILL_KEY = "soldiers-access-prefill-email";
const OPENED_SHOP_KEY = "soldiers-access-opened-shop";

export function parseAccessNext(raw: unknown): AccessNextPath | undefined {
  if (raw === "/" || raw === "/onboarding") return raw;
  return undefined;
}

export function parseAccessEmail(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const e = raw.trim().toLowerCase();
  if (!e.includes("@") || e.length > 160) return undefined;
  return e;
}

export function stashAccessPrefillEmail(email: string) {
  try {
    window.sessionStorage.setItem(PREFILL_KEY, email.trim().toLowerCase().slice(0, 160));
  } catch {
    /* ignore */
  }
}

export function peekAccessPrefillEmail(): string | null {
  try {
    return window.sessionStorage.getItem(PREFILL_KEY)?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export function markOpenedShopForRetry() {
  try {
    window.sessionStorage.setItem(OPENED_SHOP_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeOpenedShopForRetry(): boolean {
  try {
    const v = window.sessionStorage.getItem(OPENED_SHOP_KEY);
    if (v) window.sessionStorage.removeItem(OPENED_SHOP_KEY);
    return Boolean(v);
  } catch {
    return false;
  }
}

export type AccessUiState =
  | "verifying"
  | "need_auth"
  | "token_invalid"
  | "denied_stale"
  | "denied_none"
  | "denied_config"
  | "idle_auth";

export function resolveAccessUiState(opts: {
  checked: boolean;
  tokenError: boolean;
  redeemedEmail: string | null;
  hasAuthUser: boolean;
  denyReason: "stale_purchase" | "no_purchase" | "not_configured" | null;
}): AccessUiState {
  if (!opts.checked) return "verifying";
  if (opts.tokenError) return "token_invalid";
  if (opts.redeemedEmail && !opts.hasAuthUser) return "need_auth";
  if (opts.denyReason === "stale_purchase") return "denied_stale";
  if (opts.denyReason === "not_configured") return "denied_config";
  if (opts.denyReason === "no_purchase") return "denied_none";
  if (!opts.hasAuthUser) return "need_auth";
  return "idle_auth";
}
