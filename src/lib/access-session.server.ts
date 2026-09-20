/**
 * Signed HttpOnly access session (server-only).
 * Production: ACCESS_SESSION_SECRET is required (fail closed).
 * Development: ACCESS_SESSION_SECRET, or ALLOW_INSECURE_DEV_SECRETS=true with a non-production fallback.
 * Never fall back to SHOPIFY_WEBHOOK_SECRET or API keys.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

import { ACCESS_WINDOW_SEC, accessCookieExpSec, isPurchaseWithinWindow } from "@/lib/access-window";

export const ACCESS_COOKIE = "soldiers_access";
const MAX_AGE_SEC = ACCESS_WINDOW_SEC;
const DEV_ONLY_SECRET = "dev-only-change-me";

export type AccessSessionPayload = {
  email: string;
  tier: "base" | "performance";
  /** App user id (public.users) — required after establishAccessSession */
  userId?: string;
  /** ISO timestamp of last paid Shopify order — used to revalidate the 40-day window */
  lastPaidAt?: string;
  exp: number;
};

export class SecurityConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityConfigurationError";
  }
}

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function allowInsecureDev(): boolean {
  if (isProduction()) return false;
  return (
    process.env["ALLOW_INSECURE_DEV_SECRETS"] === "true" ||
    process.env["NODE_ENV"] === "test" ||
    process.env["VITEST"] === "true"
  );
}

/**
 * Validate critical secrets before protected operations.
 * Throws in production when ACCESS_SESSION_SECRET is missing.
 */
export function assertSecurityConfiguration(): void {
  const access = process.env["ACCESS_SESSION_SECRET"]?.trim() ?? "";
  if (isProduction()) {
    if (!access || access === DEV_ONLY_SECRET) {
      throw new SecurityConfigurationError(
        "ACCESS_SESSION_SECRET is required in production (fail closed)",
      );
    }
    return;
  }
  if (!access && !allowInsecureDev()) {
    throw new SecurityConfigurationError(
      "ACCESS_SESSION_SECRET missing. Set it, or ALLOW_INSECURE_DEV_SECRETS=true for local only.",
    );
  }
}

/** Resolve signing secret — never uses Shopify/API key fallbacks. */
export function resolveAccessSessionSecret(): string {
  const access = process.env["ACCESS_SESSION_SECRET"]?.trim() ?? "";
  if (access && access !== DEV_ONLY_SECRET) return access;

  if (isProduction()) {
    throw new SecurityConfigurationError(
      "ACCESS_SESSION_SECRET is required in production (fail closed)",
    );
  }

  if (allowInsecureDev()) {
    return access || DEV_ONLY_SECRET;
  }

  throw new SecurityConfigurationError(
    "ACCESS_SESSION_SECRET missing. Set it, or ALLOW_INSECURE_DEV_SECRETS=true for local only.",
  );
}

function secret(): string {
  return resolveAccessSessionSecret();
}

export function setAccessSessionCookie(
  payload: Omit<AccessSessionPayload, "exp"> & { userId: string },
) {
  assertSecurityConfiguration();
  const value = encodeAccessToken(payload);
  const decoded = decodeAccessToken(value);
  const maxAge = decoded ? Math.max(60, decoded.exp - Math.floor(Date.now() / 1000)) : MAX_AGE_SEC;
  setCookie(ACCESS_COOKIE, value, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

function b64url(buf: Buffer | string) {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function signRaw(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeAccessToken(payload: Omit<AccessSessionPayload, "exp"> & { exp?: number }): string {
  const body: AccessSessionPayload = {
    email: payload.email.trim().toLowerCase(),
    tier: payload.tier === "performance" ? "performance" : "base",
    exp: payload.exp ?? accessCookieExpSec(payload.lastPaidAt ?? null),
  };
  if (payload.userId) body.userId = payload.userId;
  if (payload.lastPaidAt) body.lastPaidAt = payload.lastPaidAt;
  const data = b64url(JSON.stringify(body));
  const sig = signRaw(data);
  return `${data}.${sig}`;
}

export function decodeAccessToken(token: string | undefined | null): AccessSessionPayload | null {
  if (!token || !token.includes(".")) return null;
  let expected: string;
  try {
    expected = signRaw(token.split(".")[0]!);
  } catch {
    return null;
  }
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as AccessSessionPayload;
    if (!json.email || !json.exp || json.exp * 1000 < Date.now()) return null;
    const lastPaidAt =
      typeof json.lastPaidAt === "string" && json.lastPaidAt.length > 8 ? json.lastPaidAt : undefined;
    if (lastPaidAt && !isPurchaseWithinWindow(lastPaidAt)) return null;
    return {
      email: String(json.email).toLowerCase(),
      tier: json.tier === "performance" ? "performance" : "base",
      exp: Number(json.exp),
      ...(typeof json.userId === "string" && json.userId.length >= 8 ? { userId: json.userId } : {}),
      ...(lastPaidAt ? { lastPaidAt } : {}),
    };
  } catch {
    return null;
  }
}

export function clearAccessSessionCookie() {
  deleteCookie(ACCESS_COOKIE, { path: "/" });
}

export function readAccessSession(): AccessSessionPayload | null {
  try {
    return decodeAccessToken(getCookie(ACCESS_COOKIE));
  } catch {
    return null;
  }
}

export function encodeAdminToken(email: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const data = b64url(
    JSON.stringify({ role: "admin", email: email.trim().toLowerCase(), exp }),
  );
  return `${data}.${signRaw(data)}`;
}

export function decodeAdminToken(
  token: string | undefined | null,
): { role: "admin"; email: string; exp: number } | null {
  if (!token?.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  let expected: string;
  try {
    expected = signRaw(data);
  } catch {
    return null;
  }
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const json = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as {
      role?: string;
      email?: string;
      exp?: number;
    };
    if (json.role !== "admin" || typeof json.exp !== "number" || json.exp * 1000 <= Date.now()) {
      return null;
    }
    const email = String(json.email ?? "")
      .trim()
      .toLowerCase();
    const fallback = (process.env["ADMIN_EMAIL"] ?? "").trim().toLowerCase();
    const resolved = email.includes("@") ? email : fallback;
    if (!resolved.includes("@")) return null;
    return { role: "admin", email: resolved, exp: json.exp };
  } catch {
    return null;
  }
}

export function readAdminSession(): boolean {
  return Boolean(decodeAdminToken(getCookie("soldiers_admin")));
}

/** App pages + server fns: access cookie, or admin session as performance. */
export function readAppAccessSession(): AccessSessionPayload | null {
  const access = readAccessSession();
  if (access) return access;
  const admin = decodeAdminToken(getCookie("soldiers_admin"));
  if (!admin) return null;
  return {
    email: admin.email,
    tier: "performance",
    exp: admin.exp,
  };
}

export function setAdminSessionCookie(email: string) {
  assertSecurityConfiguration();
  setCookie("soldiers_admin", encodeAdminToken(email), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export function clearAdminSessionCookie() {
  deleteCookie("soldiers_admin", { path: "/" });
}

/** Throws if admin cookie is missing/invalid. Use in admin-only server handlers. */
export function requireAdminSession(): void {
  if (!readAdminSession()) {
    throw new Error("UNAUTHORIZED_ADMIN");
  }
}

function secretEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function verifyAdminAuthUser(email: string, password: string): Promise<boolean> {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const anon =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "";
  if (!url || !anon) return false;
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return false;
  const role = (data.user.app_metadata as { role?: string } | undefined)?.role;
  await client.auth.signOut();
  return role === "admin";
}

export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<"ok" | "invalid" | "not_configured"> {
  const expectedEmail = (process.env["ADMIN_EMAIL"] ?? "").trim().toLowerCase();
  const expectedPass = process.env["ADMIN_PASSWORD"] || process.env["ADMIN_PIN"] || "";
  const envConfigured = Boolean(expectedEmail && expectedPass);
  const envOk =
    envConfigured && secretEqual(email, expectedEmail) && secretEqual(password, expectedPass);
  if (envOk) return "ok";
  if (await verifyAdminAuthUser(email, password)) return "ok";
  if (!envConfigured) return "not_configured";
  return "invalid";
}

/** In-memory rate limit buckets (per process). */
const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimitKey(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now > cur.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (cur.n >= limit) return false;
  cur.n += 1;
  return true;
}

/** Dual window rate limit (e.g. per-minute + per-day). Returns which window failed. */
export function rateLimitWindows(
  key: string,
  windows: Array<{ suffix: string; limit: number; windowMs: number }>,
): { ok: true } | { ok: false; window: string } {
  for (const w of windows) {
    if (!rateLimitKey(`${key}:${w.suffix}`, w.limit, w.windowMs)) {
      return { ok: false, window: w.suffix };
    }
  }
  return { ok: true };
}
