/**
 * Purchase-window access: paid order in the last N days unlocks the app.
 * Pure helpers — safe in tests and in cookie encode/decode.
 */

export const ACCESS_PURCHASE_WINDOW_DAYS = 40;

/** Admin-issued free trial (tag admin_trial_7d on entitlement snapshot). */
export const ACCESS_TRIAL_WINDOW_DAYS = 7;

export const ADMIN_TRIAL_TAG = "admin_trial_7d";

export const ACCESS_WINDOW_MS = ACCESS_PURCHASE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const ACCESS_WINDOW_SEC = ACCESS_PURCHASE_WINDOW_DAYS * 24 * 60 * 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export function windowMsForDays(windowDays: number): number {
  return Math.max(1, windowDays) * DAY_MS;
}

export function windowSecForDays(windowDays: number): number {
  return Math.max(1, windowDays) * 24 * 60 * 60;
}

/** Resolve access window from entitlement snapshot tags. */
export function windowDaysFromEntitlementTags(tags: string[] | null | undefined): number {
  if (!tags?.length) return ACCESS_PURCHASE_WINDOW_DAYS;
  if (tags.some((t) => t.trim().toLowerCase() === ADMIN_TRIAL_TAG)) {
    return ACCESS_TRIAL_WINDOW_DAYS;
  }
  return ACCESS_PURCHASE_WINDOW_DAYS;
}

export function isAdminTrialTags(tags: string[] | null | undefined): boolean {
  return windowDaysFromEntitlementTags(tags) === ACCESS_TRIAL_WINDOW_DAYS;
}

export function paidAtMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** True when last paid / trial start is within the window (default 40 days). */
export function isPurchaseWithinWindow(
  lastPaidAt: string | null | undefined,
  now = Date.now(),
  windowDays: number = ACCESS_PURCHASE_WINDOW_DAYS,
): boolean {
  const t = paidAtMs(lastPaidAt);
  if (t == null) return false;
  return now - t <= windowMsForDays(windowDays);
}

export function accessExpiresAtMs(
  lastPaidAt: string,
  now = Date.now(),
  windowDays: number = ACCESS_PURCHASE_WINDOW_DAYS,
): number {
  const paid = paidAtMs(lastPaidAt) ?? now;
  return paid + windowMsForDays(windowDays);
}

export function accessExpiresAtIso(
  lastPaidAt: string,
  now = Date.now(),
  windowDays: number = ACCESS_PURCHASE_WINDOW_DAYS,
): string {
  return new Date(accessExpiresAtMs(lastPaidAt, now, windowDays)).toISOString();
}

/** Cookie exp (unix seconds) = min(now + window, lastPaidAt + window). */
export function accessCookieExpSec(
  lastPaidAt: string | null | undefined,
  now = Date.now(),
  windowDays: number = ACCESS_PURCHASE_WINDOW_DAYS,
): number {
  const cap = Math.floor(now / 1000) + windowSecForDays(windowDays);
  if (!lastPaidAt) return cap;
  return Math.min(cap, Math.floor(accessExpiresAtMs(lastPaidAt, now, windowDays) / 1000));
}

export function orderPaidAt(order: { processed_at?: string; created_at?: string }): string | null {
  const raw = order.processed_at || order.created_at;
  return raw && paidAtMs(raw) != null ? raw : null;
}

export function latestPaidAt(
  orders: Array<{ processed_at?: string; created_at?: string }>,
): string | null {
  let best: string | null = null;
  let bestMs = -1;
  for (const o of orders) {
    const iso = orderPaidAt(o);
    const t = paidAtMs(iso);
    if (t != null && t > bestMs) {
      bestMs = t;
      best = iso;
    }
  }
  return best;
}

export function formatAccessDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Whole days left until expiry (0 if already expired). */
export function accessDaysRemaining(
  expiresAt: string | null | undefined,
  now = Date.now(),
): number | null {
  const t = paidAtMs(expiresAt);
  if (t == null) return null;
  return Math.max(0, Math.ceil((t - now) / DAY_MS));
}

export function daysSincePaid(lastPaidAt: string | null | undefined, now = Date.now()): number | null {
  const t = paidAtMs(lastPaidAt);
  if (t == null) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

export type AccessUrgency = "d7" | "d3" | "d1";

/** Countdown bands for repurchase CTA — D-7 / D-3 / D-1. */
export function accessUrgencyLevel(daysRemaining: number | null): AccessUrgency | null {
  if (daysRemaining == null) return null;
  if (daysRemaining <= 1) return "d1";
  if (daysRemaining <= 3) return "d3";
  if (daysRemaining <= 7) return "d7";
  return null;
}
