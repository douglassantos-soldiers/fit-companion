/**
 * Client sync API — domain writes go through server fns (service_role).
 * getDeviceId stays local (localStorage).
 */
import type { AppState } from "@/lib/types";
import { clearRemoteStateFn, pullStateFn, pushStateFn } from "@/lib/sync.functions";

const DEVICE_KEY = "soldiers-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Pull remote state for this device (and sibling devices of the same user). */
export async function pullState(deviceId: string): Promise<AppState | null> {
  if (!deviceId) return null;
  try {
    const res = await pullStateFn({ data: { deviceId } });
    return res.state ?? null;
  } catch (e) {
    console.error("pullState failed", e);
    return null;
  }
}

/** Push state; server stamps trusted user_id (ignores client userId claim). */
export async function pushState(deviceId: string, state: AppState): Promise<void> {
  if (!deviceId) return;
  try {
    await pushStateFn({ data: { deviceId, state } });
    const { flushOutbox } = await import("@/lib/sync/outbox");
    void flushOutbox().catch(() => undefined);
  } catch (e) {
    console.error("Falha ao sincronizar dados", e);
  }
}

export async function clearRemoteState(deviceId: string): Promise<void> {
  if (!deviceId) return;
  try {
    await clearRemoteStateFn({ data: { deviceId } });
  } catch (e) {
    console.error("clearRemoteState failed", e);
  }
}
