/**
 * Customer 360 server fns — load persisted profile for UI/Context.
 */
import { createServerFn } from "@tanstack/react-start";

function parseDevice(input: unknown) {
  const v = input as { deviceId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { deviceId };
}

export const loadCustomer360Fn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
    if (!identity) return { ok: false as const, profile: null };
    const { loadCustomerProfile } = await import("@/lib/customer360/recompute.server");
    const profile = await loadCustomerProfile(identity.userId);
    return { ok: true as const, profile, userId: identity.userId };
  });

/** Recompute from DB domain data only — never persists client AppState override. */
export const recomputeCustomer360Fn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
    if (!identity) return { ok: false as const };
    const { recomputeCustomerProfile } = await import("@/lib/customer360/recompute.server");
    await recomputeCustomerProfile(identity.userId);
    return { ok: true as const, userId: identity.userId };
  });
