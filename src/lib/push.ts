/** Register SW for future web-push; local Notification API remains primary until VAPID keys exist. */
export async function registerPushWorker(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("/sw.js");
    return true;
  } catch {
    return false;
  }
}
