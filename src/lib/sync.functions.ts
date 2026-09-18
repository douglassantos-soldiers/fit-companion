/**
 * Server fns for sync — client must not write domain tables with anon key.
 */
import { createServerFn } from "@tanstack/react-start";
import type { AppState } from "@/lib/types";

function parseDevice(input: unknown) {
  const v = input as { deviceId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { deviceId };
}

function parsePush(input: unknown) {
  const v = input as { deviceId?: string; state?: AppState } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  if (!v?.state || typeof v.state !== "object") throw new Error("state obrigatório");
  return { deviceId, state: v.state };
}

export const pullStateFn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { pullStateServer } = await import("@/lib/sync.server");
    return pullStateServer(data.deviceId);
  });

export const pushStateFn = createServerFn({ method: "POST" })
  .inputValidator(parsePush)
  .handler(async ({ data }) => {
    const { pushStateServer } = await import("@/lib/sync.server");
    return pushStateServer(data.deviceId, data.state);
  });

export const clearRemoteStateFn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { clearRemoteStateServer } = await import("@/lib/sync.server");
    return clearRemoteStateServer(data.deviceId);
  });
