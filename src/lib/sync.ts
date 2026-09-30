/**
 * Client sync API — domain writes go through server fns (service_role).
 * getDeviceId stays local (localStorage).
 */
import type { AppState } from "@/lib/types";
import { clearRemoteStateFn, pullStateFn, pushStateFn } from "@/lib/sync.functions";

const DEVICE_KEY = "soldiers-device-id";

export type PushStateResult = {
  ok: boolean;
  partial?: boolean;
  persistentFailed?: boolean;
  userId: string | null;
  conflicts?: string[];
  errors?: Array<{ table: string; code: string }>;
};

/** Full ACK only when every critical write succeeded (no partial / failed push). */
export function shouldAckPushAndFlushOutbox(result: PushStateResult): boolean {
  return result.ok === true && result.partial !== true && result.persistentFailed !== true;
}

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

/**
 * Push state; server stamps trusted user_id (ignores client userId claim).
 * Returns server result. Does not flush outbox on ok=false or partial writes.
 * Critical failures are persisted locally so the UI can surface "not saved".
 */
export async function pushState(deviceId: string, state: AppState): Promise<PushStateResult> {
  if (!deviceId) return { ok: false, userId: null };
  try {
    const result = (await pushStateFn({ data: { deviceId, state } })) as PushStateResult;
    if (!shouldAckPushAndFlushOutbox(result)) {
      console.error("Falha parcial ao sincronizar dados", {
        ok: result.ok,
        partial: result.partial,
        persistentFailed: result.persistentFailed,
        errors: result.errors,
        conflicts: result.conflicts,
      });
      if (result.persistentFailed || result.ok === false) {
        const { recordPersistentSyncFailure } = await import("@/lib/sync/critical");
        recordPersistentSyncFailure({
          at: new Date().toISOString(),
          deviceId,
          errors: result.errors ?? [{ table: "push", code: "failed" }],
        });
      }
      return result;
    }
    const { clearPersistentSyncFailure } = await import("@/lib/sync/critical");
    clearPersistentSyncFailure();
    const { flushOutbox } = await import("@/lib/sync/outbox");
    void flushOutbox().catch(() => undefined);
    return result;
  } catch (e) {
    console.error("Falha ao sincronizar dados", e);
    const { recordPersistentSyncFailure } = await import("@/lib/sync/critical");
    recordPersistentSyncFailure({
      at: new Date().toISOString(),
      deviceId,
      errors: [{ table: "client", code: "push_exception" }],
    });
    return {
      ok: false,
      persistentFailed: true,
      userId: null,
      errors: [{ table: "client", code: "push_exception" }],
    };
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
