import { getDeviceId } from "@/lib/sync";
import { getVapidPublicKey, savePushSubscription } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Register SW for web-push; local Notification API remains fallback if VAPID is unset. */
export async function registerPushWorker(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("/sw.js");
    return true;
  } catch {
    return false;
  }
}

export async function subscribePush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) return false;
  const registration = await navigator.serviceWorker.ready.catch(async () => {
    await registerPushWorker();
    return navigator.serviceWorker.ready;
  });
  const existing = await registration.pushManager.getSubscription();
  const sub =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.["p256dh"];
  const auth = json.keys?.["auth"];
  if (!endpoint || !p256dh || !auth) return false;
  const deviceId = getDeviceId();
  const saved = await savePushSubscription({
    data: { deviceId, endpoint, p256dh, auth },
  });
  return saved.ok === true;
}
