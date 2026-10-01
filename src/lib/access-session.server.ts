/**
 * Signed HttpOnly access / admin sessions (server-only).
 * Production: ACCESS_SESSION_SECRET and ADMIN_SESSION_SECRET required and must differ (fail closed).
 * Development: set both, or ALLOW_INSECURE_DEV_SECRETS=true with distinct non-production fallbacks.
 * Never fall back to SHOPIFY_WEBHOOK_SECRET or API keys.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie, deleteCookie, getRequest } from "@tanstack/react-start/server";

import { ACCESS_PURCHASE_WINDOW_DAYS, ACCESS_WINDOW_SEC, accessCookieExpSec, isPurchaseWithinWindow } from "@/lib/access-window";

export const ACCESS_COOKIE = "soldiers_access";
const MAX_AGE_SEC = ACCESS_WINDOW_SEC;
const DEV_ONLY_SECRET = "dev-only-change-me";
const DEV_ONLY_ADMIN_SECRET = "dev-only-admin-change-me";

const ADMIN_ROLES = ["admin", "editor", "support", "analyst"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** How long resolveTrustedIdentity may trust account status stamped on the access cookie. */
export const ACCESS_STATUS_COOKIE_TTL_MS = 5 * 60_000;

export type AccessSessionPayload = {
  email: string;
  tier: "base" | "performance";
  /** App user id (public.users) — required after establishAccessSession */
  userId?: string;
  /** ISO timestamp of last paid Shopify order — used to revalidate the 40-day window */
  lastPaidAt?: string;
  /** Access window in days (7 for admin trial, 40 for purchase). Defaults to 40 when absent. */
  windowDays?: number;
  /** Ban/suspend snapshot — avoids users.status on every identity resolve when fresh. */
  accountBlocked?: boolean;
  statusKnown?: boolean;
  /** ISO timestamp when accountBlocked/statusKnown were last verified against DB. */
  statusCheckedAt?: string;
  exp: number;
};

export type AccessAccountStatusStamp = {
  accountBlocked: boolean;
  statusKnown: boolean;
  statusCheckedAt: string;
};

/** Pure helper — cookie stamp usable without DB when within TTL. */
export function readFreshAccessAccountStatus(
  session: Pick<AccessSessionPayload, "accountBlocked" | "statusKnown" | "statusCheckedAt">,
  nowMs = Date.now(),
  ttlMs = ACCESS_STATUS_COOKIE_TTL_MS,
): AccessAccountStatusStamp | null {
  if (typeof session.statusCheckedAt !== "string" || !session.statusCheckedAt) return null;
  if (typeof session.statusKnown !== "boolean") return null;
  if (typeof session.accountBlocked !== "boolean") return null;
  const checked = Date.parse(session.statusCheckedAt);
  if (!Number.isFinite(checked) || nowMs - checked > ttlMs || nowMs < checked - 60_000) {
    return null;
  }
  return {
    accountBlocked: session.accountBlocked,
    statusKnown: session.statusKnown,
    statusCheckedAt: session.statusCheckedAt,
  };
}

export function accountStatusStampFromCheck(result: {
  blocked: boolean;
  statusKnown: boolean;
  nowMs?: number;
}): AccessAccountStatusStamp {
  return {
    accountBlocked: result.blocked,
    statusKnown: result.statusKnown,
    statusCheckedAt: new Date(result.nowMs ?? Date.now()).toISOString(),
  };
}

export class SecurityConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityConfigurationError";
  }
}

/** https (preview iframe + published) needs SameSite=None; Secure or the browser drops the cookie. */
function cookieFlags(): { secure: boolean; sameSite: "none" | "lax" } {
  try {
    const req = getRequest();
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
    if (proto.split(",")[0]?.trim() === "https") return { secure: true, sameSite: "none" };
  } catch {
    /* no request */
  }
  return { secure: isProduction(), sameSite: "lax" };
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

function isInsecureSecret(value: string): boolean {
  return value === DEV_ONLY_SECRET || value === DEV_ONLY_ADMIN_SECRET;
}

/**
 * Validate critical secrets before protected operations.
 * Production: both session secrets required, distinct, and not insecure fallbacks.
 */
export function assertSecurityConfiguration(): void {
  const access = process.env["ACCESS_SESSION_SECRET"]?.trim() ?? "";
  const admin = process.env["ADMIN_SESSION_SECRET"]?.trim() ?? "";

  if (isProduction()) {
    if (!access || isInsecureSecret(access)) {
      throw new SecurityConfigurationError(
        "ACCESS_SESSION_SECRET is required in production (fail closed)",
      );
    }
    if (!admin || isInsecureSecret(admin)) {
      throw new SecurityConfigurationError(
        "ADMIN_SESSION_SECRET is required in production (fail closed)",
      );
    }
    if (access === admin) {
      throw new SecurityConfigurationError(
        "ADMIN_SESSION_SECRET must differ from ACCESS_SESSION_SECRET in production",
      );
    }
    return;
  }

  if (!access && !allowInsecureDev()) {
    throw new SecurityConfigurationError(
      "ACCESS_SESSION_SECRET missing. Set it, or ALLOW_INSECURE_DEV_SECRETS=true for local only.",
    );
  }
  if (!admin && !allowInsecureDev()) {
    throw new SecurityConfigurationError(
      "ADMIN_SESSION_SECRET missing. Set it, or ALLOW_INSECURE_DEV_SECRETS=true for local only.",
    );
  }
}

/** Resolve access signing secret — never uses Shopify/API key fallbacks. */
export function resolveAccessSessionSecret(): string {
  const access = process.env["ACCESS_SESSION_SECRET"]?.trim() ?? "";
  if (access && !isInsecureSecret(access)) return access;

  if (isProduction()) {
    throw new SecurityConfigurationError(
      "ACCESS_SESSION_SECRET is required in production (fail closed)",
    );
  }

  if (allowInsecureDev()) {
    return access && access !== DEV_ONLY_ADMIN_SECRET ? access : DEV_ONLY_SECRET;
  }

  throw new SecurityConfigurationError(
    "ACCESS_SESSION_SECRET missing. Set it, or ALLOW_INSECURE_DEV_SECRETS=true for local only.",
  );
}

/** Resolve admin signing secret — never shares HMAC with access sessions. */
export function resolveAdminSessionSecret(): string {
  const admin = process.env["ADMIN_SESSION_SECRET"]?.trim() ?? "";
  if (admin && !isInsecureSecret(admin)) {
    if (isProduction()) {
      const access = process.env["ACCESS_SESSION_SECRET"]?.trim() ?? "";
      if (admin === access) {
        throw new SecurityConfigurationError(
          "ADMIN_SESSION_SECRET must differ from ACCESS_SESSION_SECRET in production",
        );
      }
    }
    return admin;
  }

  if (isProduction()) {
    throw new SecurityConfigurationError(
      "ADMIN_SESSION_SECRET is required in production (fail closed)",
    );
  }

  if (allowInsecureDev()) {
    return admin && admin !== DEV_ONLY_SECRET ? admin : DEV_ONLY_ADMIN_SECRET;
  }

  throw new SecurityConfigurationError(
    "ADMIN_SESSION_SECRET missing. Set it, or ALLOW_INSECURE_DEV_SECRETS=true for local only.",
  );
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
    ...cookieFlags(),
    path: "/",
    maxAge,
  });
}

function b64url(buf: Buffer | string) {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function signRaw(data: string, signingSecret: string) {
  return createHmac("sha256", signingSecret).update(data).digest("base64url");
}

function signAccessRaw(data: string) {
  return signRaw(data, resolveAccessSessionSecret());
}

function signAdminRaw(data: string) {
  return signRaw(data, resolveAdminSessionSecret());
}

function parseAdminRole(raw: unknown): AdminRole | null {
  if (typeof raw !== "string") return null;
  return (ADMIN_ROLES as readonly string[]).includes(raw) ? (raw as AdminRole) : null;
}

export function encodeAccessToken(
  payload: Omit<AccessSessionPayload, "exp"> & { exp?: number },
): string {
  const windowDays =
    typeof payload.windowDays === "number" && payload.windowDays > 0
      ? Math.floor(payload.windowDays)
      : undefined;
  const body: AccessSessionPayload & { kind: "access" } = {
    kind: "access",
    email: payload.email.trim().toLowerCase(),
    tier: payload.tier === "performance" ? "performance" : "base",
    exp: payload.exp ?? accessCookieExpSec(payload.lastPaidAt ?? null, Date.now(), windowDays ?? ACCESS_PURCHASE_WINDOW_DAYS),
  };
  if (payload.userId) body.userId = payload.userId;
  if (payload.lastPaidAt) body.lastPaidAt = payload.lastPaidAt;
  if (windowDays != null) body.windowDays = windowDays;
  if (typeof payload.accountBlocked === "boolean") body.accountBlocked = payload.accountBlocked;
  if (typeof payload.statusKnown === "boolean") body.statusKnown = payload.statusKnown;
  if (typeof payload.statusCheckedAt === "string" && payload.statusCheckedAt.length >= 10) {
    body.statusCheckedAt = payload.statusCheckedAt;
  }
  const data = b64url(JSON.stringify(body));
  const sig = signAccessRaw(data);
  return `${data}.${sig}`;
}

export function decodeAccessToken(token: string | undefined | null): AccessSessionPayload | null {
  if (!token || !token.includes(".")) return null;
  let expected: string;
  try {
    expected = signAccessRaw(token.split(".")[0]!);
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
    ) as AccessSessionPayload & { kind?: string };
    if (json.kind !== "access") return null;
    if (!json.email || !json.exp || json.exp * 1000 < Date.now()) return null;
    // Access sessions always encode tier explicitly
    if (json.tier !== "base" && json.tier !== "performance") return null;
    const lastPaidAt =
      typeof json.lastPaidAt === "string" && json.lastPaidAt.length > 8
        ? json.lastPaidAt
        : undefined;
    const windowDays =
      typeof json.windowDays === "number" && json.windowDays > 0
        ? Math.floor(json.windowDays)
        : ACCESS_PURCHASE_WINDOW_DAYS;
    if (lastPaidAt && !isPurchaseWithinWindow(lastPaidAt, Date.now(), windowDays)) return null;
    const statusCheckedAt =
      typeof json.statusCheckedAt === "string" && json.statusCheckedAt.length >= 10
        ? json.statusCheckedAt
        : undefined;
    return {
      email: String(json.email).toLowerCase(),
      tier: json.tier,
      exp: Number(json.exp),
      ...(typeof json.userId === "string" && json.userId.length >= 8
        ? { userId: json.userId }
        : {}),
      ...(lastPaidAt ? { lastPaidAt } : {}),
      ...(windowDays !== ACCESS_PURCHASE_WINDOW_DAYS ? { windowDays } : {}),
      ...(typeof json.accountBlocked === "boolean" ? { accountBlocked: json.accountBlocked } : {}),
      ...(typeof json.statusKnown === "boolean" ? { statusKnown: json.statusKnown } : {}),
      ...(statusCheckedAt ? { statusCheckedAt } : {}),
    };
  } catch {
    return null;
  }
}

export function clearAccessSessionCookie() {
  deleteCookie(ACCESS_COOKIE, { path: "/", ...cookieFlags() });
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

export type AdminSessionPayload = {
  role: AdminRole;
  email: string;
  exp: number;
};

export function encodeAdminToken(email: string, role: AdminRole = "admin"): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const data = b64url(
    JSON.stringify({
      kind: "admin",
      role,
      email: email.trim().toLowerCase(),
      exp,
    }),
  );
  return `${data}.${signAdminRaw(data)}`;
}

export function decodeAdminToken(token: string | undefined | null): AdminSessionPayload | null {
  if (!token?.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  let expected: string;
  try {
    expected = signAdminRaw(data);
  } catch {
    return null;
  }
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const json = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as {
      kind?: string;
      role?: string;
      email?: string;
      exp?: number;
    };
    if (json.kind !== "admin") return null;
    const role = parseAdminRole(json.role);
    if (!role) return null;
    if (typeof json.exp !== "number" || json.exp * 1000 <= Date.now()) {
      return null;
    }
    const email = String(json.email ?? "")
      .trim()
      .toLowerCase();
    if (!email.includes("@")) return null;
    return { role, email, exp: json.exp };
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
    ...cookieFlags(),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export function clearAdminSessionCookie() {
  deleteCookie("soldiers_admin", { path: "/", ...cookieFlags() });
}

function secretEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function verifyAdminAuthUser(email: string, password: string): Promise<AdminRole | false> {
  const url =
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    import.meta.env["VITE_SUPABASE_URL"] ||
    "";
  const anon =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    "";
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
  return { ok: false, reason: "invalid" };
}

/**
 * Opaque client IP fingerprint for distributed rate limits.
 * Prefer first X-Forwarded-For hop, then common proxy headers.
 */
export function resolveClientIpFingerprint(): string {
  try {
    const request = getRequest();
    const headers = request.headers;
    const forwarded = headers.get("x-forwarded-for");
    const firstHop = forwarded?.split(",")[0]?.trim() ?? "";
    const raw =
      firstHop ||
      headers.get("cf-connecting-ip")?.trim() ||
      headers.get("x-real-ip")?.trim() ||
      "";
    if (!raw) return "unknown";
    return createHash("sha256").update(raw).digest("hex").slice(0, 32);
  } catch {
    return "unknown";
  }
}
