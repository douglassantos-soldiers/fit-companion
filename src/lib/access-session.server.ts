/**
 * Signed HttpOnly access session (server-only).
 * Secret: ACCESS_SESSION_SECRET || SHOPIFY_WEBHOOK_SECRET || OPENAI_API_KEY (dev fallback).
 * Rotate SHOPIFY_ADMIN_ACCESS_TOKEN in Shopify Admin if .env was ever committed.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

export const ACCESS_COOKIE = "soldiers_access";
const MAX_AGE_SEC = 60 * 60 * 24 * 400; // ~400 days

export type AccessSessionPayload = {
  email: string;
  tier: "base" | "performance";
  exp: number;
};

function secret(): string {
  return (
    process.env["ACCESS_SESSION_SECRET"] ||
    process.env["SHOPIFY_WEBHOOK_SECRET"] ||
    process.env["OPENAI_API_KEY"] ||
    "dev-only-change-me"
  );
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
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const data = b64url(JSON.stringify(body));
  const sig = signRaw(data);
  return `${data}.${sig}`;
}

export function decodeAccessToken(token: string | undefined | null): AccessSessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = signRaw(data);
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
    return {
      email: String(json.email).toLowerCase(),
      tier: json.tier === "performance" ? "performance" : "base",
      exp: Number(json.exp),
    };
  } catch {
    return null;
  }
}

export function setAccessSessionCookie(payload: Omit<AccessSessionPayload, "exp">) {
  const value = encodeAccessToken(payload);
  setCookie(ACCESS_COOKIE, value, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export function clearAccessSessionCookie() {
  deleteCookie(ACCESS_COOKIE, { path: "/" });
}

export function readAccessSession(): AccessSessionPayload | null {
  return decodeAccessToken(getCookie(ACCESS_COOKIE));
}

export function encodeAdminToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const data = b64url(JSON.stringify({ role: "admin", exp }));
  return `${data}.${signRaw(data)}`;
}

export function readAdminSession(): boolean {
  const token = getCookie("soldiers_admin");
  if (!token?.includes(".")) return false;
  const [data, sig] = token.split(".");
  if (!data || !sig) return false;
  const expected = signRaw(data);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const json = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as { role?: string; exp?: number };
    return json.role === "admin" && typeof json.exp === "number" && json.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function setAdminSessionCookie() {
  setCookie("soldiers_admin", encodeAdminToken(), {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
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
