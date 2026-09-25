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

export function encodeAccessToken(
  payload: Omit<AccessSessionPayload, "exp"> & { exp?: number },
): string {
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
    const json = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as AccessSessionPayload & { role?: string };
    // Reject admin token shape (role without access session fields)
    if (typeof (json as { role?: unknown }).role === "string") return null;
    if (!json.email || !json.exp || json.exp * 1000 < Date.now()) return null;
    // Access sessions always encode tier explicitly
    if (json.tier !== "base" && json.tier !== "performance") return null;
    const lastPaidAt =
      typeof json.lastPaidAt === "string" && json.lastPaidAt.length > 8
        ? json.lastPaidAt
        : undefined;
    if (lastPaidAt && !isPurchaseWithinWindow(lastPaidAt)) return null;
    return {
      email: String(json.email).toLowerCase(),
      tier: json.tier,
      exp: Number(json.exp),
      ...(typeof json.userId === "string" && json.userId.length >= 8
        ? { userId: json.userId }
        : {}),
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

/**
 * Raw access cookie value (for deriving a non-reversible sessionId).
 * Never log or return this to clients.
 */
export function readAccessSessionToken(): string | null {
  try {
    const raw = getCookie(ACCESS_COOKIE);
    if (!raw || !decodeAccessToken(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Stable opaque session id from access token (sha256 hex, truncated). */
export function deriveAccessSessionId(token: string | null | undefined): string | null {
  if (!token) return null;
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

export type AdminRole = "admin" | "editor" | "support" | "analyst";

export type AdminSessionPayload = {
  role: AdminRole;
  email: string;
  exp: number;
};

export function encodeAdminToken(email: string, role: AdminRole = "admin"): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const data = b64url(
    JSON.stringify({
      role,
      email: email.trim().toLowerCase(),
      exp,
    }),
  );
  return `${data}.${signRaw(data)}`;
}

export function decodeAdminToken(token: string | undefined | null): AdminSessionPayload | null {
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
    const roleRaw = String(json.role ?? "admin");
    const role: AdminRole =
      roleRaw === "editor" || roleRaw === "support" || roleRaw === "analyst" || roleRaw === "admin"
        ? roleRaw
        : "admin";
    // Legacy PIN tokens only ever issued "admin"; reject unknown
    if (role !== "admin" && role !== "editor" && role !== "support" && role !== "analyst") {
      return null;
    }
    if (typeof json.exp !== "number" || json.exp * 1000 <= Date.now()) {
      return null;
    }
    const email = String(json.email ?? "")
      .trim()
      .toLowerCase();
    const fallback = (process.env["ADMIN_EMAIL"] ?? "").trim().toLowerCase();
    const resolved = email.includes("@") ? email : fallback;
    if (!resolved.includes("@")) return null;
    return { role, email: resolved, exp: json.exp };
  } catch {
    return null;
  }
}

export function readAdminSession(): boolean {
  return Boolean(decodeAdminToken(getCookie("soldiers_admin")));
}

export function readAdminSessionPayload(): AdminSessionPayload | null {
  return decodeAdminToken(getCookie("soldiers_admin"));
}

/** Throws if admin cookie missing/invalid or role not allowed. */
export function requireAdminSession(allowed: AdminRole[] = ["admin"]): AdminSessionPayload {
  const session = readAdminSessionPayload();
  if (!session) throw new Error("UNAUTHORIZED_ADMIN");
  if (!allowed.includes(session.role)) throw new Error("UNAUTHORIZED_ADMIN_ROLE");
  return session;
}

export function assertAdminRole(allowed: AdminRole[] = ["admin"]): AdminSessionPayload {
  return requireAdminSession(allowed);
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

export function setAdminSessionCookie(email: string, role: AdminRole = "admin") {
  assertSecurityConfiguration();
  setCookie("soldiers_admin", encodeAdminToken(email, role), {
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

function secretEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function verifyAdminAuthUser(email: string, password: string): Promise<AdminRole | false> {
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
  const roleRaw = (data.user.app_metadata as { role?: string } | undefined)?.role;
  await client.auth.signOut();
  if (
    roleRaw === "admin" ||
    roleRaw === "editor" ||
    roleRaw === "support" ||
    roleRaw === "analyst"
  ) {
    return roleRaw;
  }
  return false;
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

/** Authenticate and return role for cookie (PIN legacy → admin). */
export async function authenticateAdminWithRole(
  email: string,
  password: string,
): Promise<{ ok: true; role: AdminRole } | { ok: false; reason: "invalid" | "not_configured" }> {
  const expectedEmail = (process.env["ADMIN_EMAIL"] ?? "").trim().toLowerCase();
  const expectedPass = process.env["ADMIN_PASSWORD"] || process.env["ADMIN_PIN"] || "";
  const envConfigured = Boolean(expectedEmail && expectedPass);
  const envOk =
    envConfigured && secretEqual(email, expectedEmail) && secretEqual(password, expectedPass);
  if (envOk) return { ok: true, role: "admin" };
  const authRole = await verifyAdminAuthUser(email, password);
  if (authRole) return { ok: true, role: authRole };
  if (!envConfigured) return { ok: false, reason: "not_configured" };
  return { ok: false, reason: "invalid" };
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
