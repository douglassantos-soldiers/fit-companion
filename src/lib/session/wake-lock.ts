import { useEffect } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Keep the screen awake while a workout session is active.
 * No-ops when the Screen Wake Lock API is missing or permission is denied.
 */
export function useSessionWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined") return;
    const api = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } })
      .wakeLock;
    if (!api?.request) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let released = false;

    const request = async () => {
      if (released) return;
      try {
        sentinel = await api.request("screen");
      } catch {
        sentinel = null;
      }
    };

    void request();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}
