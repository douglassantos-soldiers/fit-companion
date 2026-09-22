/**
 * User-day helpers — never use UTC date slicing for "today" of the user.
 * Default timezone: America/Sao_Paulo.
 */

export const DEFAULT_USER_TIMEZONE = "America/Sao_Paulo";

export function normalizeUserTimezone(tz: string | null | undefined): string {
  const t = String(tz ?? "").trim();
  if (!t) return DEFAULT_USER_TIMEZONE;
  try {
    // Validate IANA zone
    Intl.DateTimeFormat("en-US", { timeZone: t }).format(new Date());
    return t;
  } catch {
    return DEFAULT_USER_TIMEZONE;
  }
}

/** Browser IANA zone when available; otherwise Soldiers default (BR). */
export function detectClientTimezone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return normalizeUserTimezone(resolved);
  } catch {
    return DEFAULT_USER_TIMEZONE;
  }
}

/** Fill missing profile.timezone without overwriting an explicit value. */
export function withProfileTimezone<T extends { timezone?: string }>(profile: T, tz?: string | null): T {
  if (profile.timezone && String(profile.timezone).trim()) {
    return { ...profile, timezone: normalizeUserTimezone(profile.timezone) };
  }
  return { ...profile, timezone: normalizeUserTimezone(tz ?? detectClientTimezone()) };
}

/**
 * Calendar date key (YYYY-MM-DD) in the user's timezone.
 */
export function getUserTodayKey(
  userTimezone: string | null | undefined = DEFAULT_USER_TIMEZONE,
  now: Date = new Date(),
): string {
  const tz = normalizeUserTimezone(userTimezone);
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Date key for an arbitrary instant in user TZ. */
export function getUserDateKey(
  date: Date,
  userTimezone: string | null | undefined = DEFAULT_USER_TIMEZONE,
): string {
  return getUserTodayKey(userTimezone, date);
}

/** Offset calendar day in user TZ (approx via noon anchor). */
export function shiftUserDateKey(dateKey: string, deltaDays: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
