/**
 * Wearable OAuth (Fase 15). No-op without env. Apple/HC never verify on web.
 * Auth via resolveTrustedIdentity — never trust session.userId alone without device bind.
 */
import { createServerFn } from "@tanstack/react-start";
import { rateLimitKey } from "@/lib/access-session.server";
import { adminDbLoose } from "@/lib/db-admin";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import {
  normalizeGarminActivities,
  normalizeStravaActivities,
  samplesToActivityLogs,
} from "@/lib/wearables/normalize";
import type { ActivityLogEntry } from "@/lib/types";

export type WearableProviderReady = "ready" | "not_configured" | "needs_native";

export type WearableProvidersStatus = {
  strava: WearableProviderReady;
  garmin: WearableProviderReady;
  apple_health: "needs_native";
  health_connect: "needs_native";
};

export type WearableFnError =
  "unauthorized" | "rate_limited" | "not_configured" | "needs_native" | "upstream" | "invalid";

export function stravaOAuthConfigured(): boolean {
  return Boolean(
    process.env["STRAVA_CLIENT_ID"]?.trim() && process.env["STRAVA_CLIENT_SECRET"]?.trim(),
  );
}

export function garminOAuthConfigured(): boolean {
  return Boolean(
    process.env["GARMIN_CLIENT_ID"]?.trim() && process.env["GARMIN_CLIENT_SECRET"]?.trim(),
  );
}

function appOrigin(): string {
  const raw =
    process.env["APP_URL"]?.trim() ||
    process.env["VITE_APP_URL"]?.trim() ||
    "http://localhost:8081";
  return raw.replace(/\/$/, "");
}

export const getWearableProvidersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<WearableProvidersStatus> => {
    return {
      strava: stravaOAuthConfigured() ? "ready" : "not_configured",
      garmin: garminOAuthConfigured() ? "ready" : "not_configured",
      apple_health: "needs_native",
      health_connect: "needs_native",
    };
  },
);

function parseProvider(input: unknown): {
  provider: "strava" | "garmin";
  deviceId: string;
  code?: string;
} {
  const raw = input as { provider?: string; deviceId?: string; code?: string } | null;
  const p = String(raw?.provider ?? "strava");
  if (p !== "strava" && p !== "garmin") throw new Error("provider inválido");
  const deviceId = String(raw?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  const codeRaw = String(raw?.code ?? "").trim();
  const out: { provider: "strava" | "garmin"; deviceId: string; code?: string } = {
    provider: p,
    deviceId,
  };
  if (codeRaw) out.code = codeRaw;
  return out;
}

export const connectWearableFn = createServerFn({ method: "POST" })
  .inputValidator(parseProvider)
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; authUrl: string } | { ok: false; reason: WearableFnError }> => {
      const identity = await resolveTrustedIdentity({
        deviceId: data.deviceId,
        requireAccess: true,
      });
      if (!identity) return { ok: false, reason: "unauthorized" };
      const rlKey = identity.email ?? identity.userId;
      if (!rateLimitKey(`wearable-connect:${rlKey}`, 20, 60 * 60_000)) {
        return { ok: false, reason: "rate_limited" };
      }
      const redirect = `${appOrigin()}/wearables/callback`;
      if (data.provider === "strava") {
        if (!stravaOAuthConfigured()) return { ok: false, reason: "not_configured" };
        const clientId = process.env["STRAVA_CLIENT_ID"]!.trim();
        const authUrl = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&approval_prompt=auto&scope=activity:read_all&state=strava`;
        return { ok: true, authUrl };
      }
      if (!garminOAuthConfigured()) return { ok: false, reason: "not_configured" };
      const clientId = process.env["GARMIN_CLIENT_ID"]!.trim();
      const authUrl = `https://connect.garmin.com/oauthConfirm?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&state=garmin`;
      return { ok: true, authUrl };
    },
  );

async function saveTokens(
  userId: string,
  provider: "strava" | "garmin",
  tokens: { access_token: string; refresh_token?: string; expires_in?: number },
) {
  const db = await adminDbLoose();
  if (!db) return;
  const expires =
    typeof tokens.expires_in === "number"
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;
  await db.from("wearable_connections").upsert({
    user_id: userId,
    provider,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: expires,
    updated_at: new Date().toISOString(),
  });
}

async function persistWearableActivities(
  userId: string,
  provider: "strava" | "garmin",
  logs: ActivityLogEntry[],
) {
  if (!logs.length) return;
  const { activitiesFromWearableLogs } = await import("@/lib/athlete/normalize");
  const { upsertActivities } = await import("@/lib/athlete/persist.server");
  await upsertActivities(userId, activitiesFromWearableLogs(userId, logs, provider));
}

async function loadToken(userId: string, provider: "strava" | "garmin"): Promise<string | null> {
  const db = await adminDbLoose();
  if (!db) return null;
  const { data } = await db
    .from("wearable_connections")
    .select("access_token")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  const token = data?.access_token;
  return typeof token === "string" && token ? token : null;
}

export const syncWearableFn = createServerFn({ method: "POST" })
  .inputValidator(parseProvider)
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; logs: ActivityLogEntry[] } | { ok: false; reason: WearableFnError }
    > => {
      const identity = await resolveTrustedIdentity({
        deviceId: data.deviceId,
        requireAccess: true,
      });
      if (!identity) return { ok: false, reason: "unauthorized" };
      const rlKey = identity.email ?? identity.userId;
      if (!rateLimitKey(`wearable-sync:${rlKey}`, 30, 60 * 60_000)) {
        return { ok: false, reason: "rate_limited" };
      }
      const userId = identity.userId;

      if (data.provider === "strava") {
        if (!stravaOAuthConfigured()) return { ok: false, reason: "not_configured" };
        let token = await loadToken(userId, "strava");
        if (data.code) {
          try {
            const res = await fetch("https://www.strava.com/oauth/token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                client_id: process.env["STRAVA_CLIENT_ID"],
                client_secret: process.env["STRAVA_CLIENT_SECRET"],
                code: data.code,
                grant_type: "authorization_code",
              }),
            });
            if (!res.ok) return { ok: false, reason: "upstream" };
            const json = (await res.json()) as {
              access_token?: string;
              refresh_token?: string;
              expires_in?: number;
            };
            if (!json.access_token) return { ok: false, reason: "upstream" };
            token = json.access_token;
            const stored: { access_token: string; refresh_token?: string; expires_in?: number } = {
              access_token: json.access_token,
            };
            if (json.refresh_token) stored.refresh_token = json.refresh_token;
            if (json.expires_in != null) stored.expires_in = json.expires_in;
            await saveTokens(userId, "strava", stored);
          } catch {
            return { ok: false, reason: "upstream" };
          }
        }
        if (!token) return { ok: false, reason: "invalid" };
        try {
          const act = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=50", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!act.ok) return { ok: false, reason: "upstream" };
          const payload = await act.json();
          const samples = normalizeStravaActivities(payload);
          const logs = samplesToActivityLogs(samples, "oauth");
          await persistWearableActivities(userId, "strava", logs);
          return { ok: true, logs };
        } catch {
          return { ok: false, reason: "upstream" };
        }
      }

      if (!garminOAuthConfigured()) return { ok: false, reason: "not_configured" };
      let token = await loadToken(userId, "garmin");
      if (data.code) {
        try {
          const res = await fetch("https://diauth.garmin.com/di-oauth2/authorize/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env["GARMIN_CLIENT_ID"] ?? "",
              client_secret: process.env["GARMIN_CLIENT_SECRET"] ?? "",
              code: data.code,
              grant_type: "authorization_code",
              redirect_uri: `${appOrigin()}/wearables/callback`,
            }),
          });
          if (!res.ok) return { ok: false, reason: "upstream" };
          const json = (await res.json()) as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
          };
          if (!json.access_token) return { ok: false, reason: "upstream" };
          token = json.access_token;
          const stored: { access_token: string; refresh_token?: string; expires_in?: number } = {
            access_token: json.access_token,
          };
          if (json.refresh_token) stored.refresh_token = json.refresh_token;
          if (json.expires_in != null) stored.expires_in = json.expires_in;
          await saveTokens(userId, "garmin", stored);
        } catch {
          return { ok: false, reason: "upstream" };
        }
      }
      if (!token) return { ok: false, reason: "invalid" };
      try {
        const act = await fetch("https://apis.garmin.com/wellness-api/rest/activityDetails", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!act.ok) return { ok: false, reason: "upstream" };
        const payload = await act.json();
        const samples = normalizeGarminActivities(payload);
        const logs = samplesToActivityLogs(samples, "oauth");
        await persistWearableActivities(userId, "garmin", logs);
        return { ok: true, logs };
      } catch {
        return { ok: false, reason: "upstream" };
      }
    },
  );
