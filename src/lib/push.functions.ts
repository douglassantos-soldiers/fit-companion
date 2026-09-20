import { createServerFn } from "@tanstack/react-start";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";

function parseSubscribe(input: unknown): {
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const raw = input as {
    deviceId?: string;
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  } | null;
  const endpoint = String(raw?.endpoint ?? "").trim();
  const p256dh = String(raw?.p256dh ?? "").trim();
  const auth = String(raw?.auth ?? "").trim();
  if (!endpoint || !p256dh || !auth) throw new Error("Subscription inválida");
  return {
    deviceId: String(raw?.deviceId ?? "").trim(),
    endpoint,
    p256dh,
    auth,
  };
}

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { getVapidPublicKeyServer } = await import("@/lib/push.server");
  return { publicKey: getVapidPublicKeyServer() };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator(parseSubscribe)
  .handler(async ({ data }) => {
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId, requireAccess: true });
    if (!identity) return { ok: false as const };
    const { savePushSubscriptionServer } = await import("@/lib/push.server");
    return savePushSubscriptionServer({
      userId: identity.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      userAgent: typeof process === "undefined" ? null : null,
    });
  });

export const sendDailyPushesFn = createServerFn({ method: "POST" }).handler(async () => {
  const { sendDailyPushes } = await import("@/lib/push.server");
  return sendDailyPushes();
});
