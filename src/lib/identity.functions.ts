/**
 * Server fns for Identity Engine — register device → user without trusting client identity claims.
 */
import { createServerFn } from "@tanstack/react-start";

function parseDevice(input: unknown) {
  const v = input as { deviceId?: string; platform?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { deviceId, platform: String(v?.platform ?? "web").slice(0, 32) };
}

/** Ensure the device has a persistent app user. Returns userId. */
export const ensureIdentityForDevice = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { ensureUserForDevice } = await import("@/lib/identity");
    const user = await ensureUserForDevice(data.deviceId, data.platform);
    if (!user) return { ok: false as const, userId: null };
    return { ok: true as const, userId: user.id, email: user.email };
  });
