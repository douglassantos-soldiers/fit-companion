/**
 * Customer 360 server fns — load persisted profile for UI/Context.
 */
import { createServerFn } from "@tanstack/react-start";
import type { AppState } from "@/lib/types";

function parseDevice(input: unknown) {
  const v = input as { deviceId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { deviceId };
}

function parseRecompute(input: unknown) {
  const v = input as { deviceId?: string; state?: AppState } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { deviceId, state: v?.state ?? null };
}

export const loadCustomer360Fn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId });
    if (!identity) return { ok: false as const, profile: null };
    const { loadCustomerProfile } = await import("@/lib/customer360/recompute.server");
    const profile = await loadCustomerProfile(identity.userId);
    return { ok: true as const, profile, userId: identity.userId };
  });

/** Recompute with optional AppState so non-commerce metrics are not wiped. */
export const recomputeCustomer360Fn = createServerFn({ method: "POST" })
  .inputValidator(parseRecompute)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId });
    if (!identity) return { ok: false as const };
    const { recomputeCustomerProfile } = await import("@/lib/customer360/recompute.server");
    await recomputeCustomerProfile(identity.userId, data.state);
    return { ok: true as const, userId: identity.userId };
  });
