/**
 * Server fns for Learning Engine — resolve userId from session/device, never trust client claim.
 */
import { createServerFn } from "@tanstack/react-start";
import type { AppState } from "@/lib/types";
import type { UserPatterns } from "@/lib/engine/learning";

function parsePersist(input: unknown): { deviceId: string; patterns: UserPatterns } {
  const v = input as { deviceId?: string; userId?: string; patterns?: UserPatterns } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  if (!v?.patterns || typeof v.patterns !== "object") throw new Error("patterns obrigatório");
  return { deviceId, patterns: v.patterns };
}

function parseLoad(input: unknown): { deviceId: string } {
  const v = input as { deviceId?: string; userId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { deviceId };
}

/** Persist patterns for the session user (requireAccess). */
export const persistUserPatterns = createServerFn({ method: "POST" })
  .inputValidator(parsePersist)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccess: true,
    });
    if (!identity) return { ok: false as const };
    const { saveUserPatterns } = await import("@/lib/engine/learning-patterns.server");
    const ok = await saveUserPatterns(identity.userId, data.patterns);
    return { ok };
  });

/** Load persisted patterns for the device's user. */
export const loadUserPatternsFn = createServerFn({ method: "POST" })
  .inputValidator(parseLoad)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId });
    if (!identity) return { ok: false as const, patterns: null };
    const { loadUserPatterns } = await import("@/lib/engine/learning-patterns.server");
    const patterns = await loadUserPatterns(identity.userId);
    return { ok: true as const, patterns };
  });

export async function persistPatternsForUser(
  userId: string,
  state: Pick<AppState, "sessions" | "meals">,
): Promise<boolean> {
  const { extractUserPatterns } = await import("@/lib/engine/learning");
  const { saveUserPatterns } = await import("@/lib/engine/learning-patterns.server");
  const patterns = extractUserPatterns(state as AppState);
  return saveUserPatterns(userId, patterns);
}
