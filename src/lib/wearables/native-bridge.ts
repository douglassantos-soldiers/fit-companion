/**
 * Native wearable bridge for Apple Health / Health Connect.
 * PWA cannot read HealthKit directly — the native shell posts activity payloads
 * via postMessage, or the user imports a JSON health dump.
 */
import type { ActivityLogEntry, WearableProviderId } from "@/lib/types";
import { normalizeHealthDump, samplesToActivityLogs } from "@/lib/wearables/normalize";

export type NativeWearableMessage = {
  source: "soldiers-native";
  type: "wearable_activities" | "wearable_status";
  provider?: "apple_health" | "health_connect";
  /** Rows compatible with normalizeHealthDump: { id, date, kind, value } */
  activities?: unknown[];
  status?: "available" | "denied" | "unavailable";
};

function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
    SoldiersNative?: { requestHealth?: (provider: string) => void };
  };
  return Boolean(w.Capacitor?.isNativePlatform?.() || w.SoldiersNative);
}

export function nativeWearableAvailable(): boolean {
  return isNativeShell();
}

/** Ask the native shell to open Health permissions / sync. */
export function requestNativeHealthSync(provider: "apple_health" | "health_connect"): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SoldiersNative?: { requestHealth?: (provider: string) => void };
    webkit?: { messageHandlers?: { soldiers?: { postMessage: (m: unknown) => void } } };
  };
  if (w.SoldiersNative?.requestHealth) {
    w.SoldiersNative.requestHealth(provider);
    return true;
  }
  if (w.webkit?.messageHandlers?.soldiers?.postMessage) {
    w.webkit.messageHandlers.soldiers.postMessage({ type: "request_health", provider });
    return true;
  }
  window.dispatchEvent(new CustomEvent("soldiers:request-health", { detail: { provider } }));
  return isNativeShell();
}

export function activitiesFromNativePayload(
  provider: "apple_health" | "health_connect",
  activities: unknown[],
): ActivityLogEntry[] {
  const samples = normalizeHealthDump(provider, activities);
  // Native shell = verified path; web import stays pending via samplesToActivityLogs("import")
  return samplesToActivityLogs(samples, isNativeShell() ? "oauth" : "import").map((e) =>
    isNativeShell()
      ? { ...e, status: "verified" as const, source: provider }
      : e,
  );
}

/** Parse a JSON health dump export. */
export function parseHealthExportJson(
  text: string,
  provider: "apple_health" | "health_connect",
): ActivityLogEntry[] {
  try {
    const data = JSON.parse(text) as { activities?: unknown[] } | unknown[];
    const list = Array.isArray(data) ? data : (data.activities ?? []);
    return activitiesFromNativePayload(provider, list);
  } catch {
    return [];
  }
}

/** Subscribe to postMessage from the native shell. Returns unsubscribe. */
export function watchNativeWearableMessages(
  onActivities: (provider: WearableProviderId, logs: ActivityLogEntry[]) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: MessageEvent) => {
    const data = event.data as NativeWearableMessage | null;
    if (!data || data.source !== "soldiers-native") return;
    if (data.type !== "wearable_activities" || !data.activities?.length) return;
    const provider = data.provider ?? "apple_health";
    onActivities(provider, activitiesFromNativePayload(provider, data.activities));
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
