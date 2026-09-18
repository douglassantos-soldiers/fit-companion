/**
 * Server fns for Learning Engine — resolve userId from session/device, never trust client claim.
 */
import { createServerFn } from "@tanstack/react-start";
import type { AppState } from "@/lib/types";
import type { UserPatterns } from "@/lib/engine/learning";
import type { PatternsBlobV2 } from "@/lib/engine/learned-patterns";

function parsePersist(input: unknown): {
  deviceId: string;
  patterns: UserPatterns | PatternsBlobV2;
} {
  const v = input as {
    deviceId?: string;
    userId?: string;
    patterns?: UserPatterns | PatternsBlobV2;
  } | null;
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

/** Persist patterns for the session user (requireAccess). Accepts flat or blob v2. */
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

/** Load persisted patterns blob (v2) for the device's user. */
export const loadUserPatternsFn = createServerFn({ method: "POST" })
  .inputValidator(parseLoad)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId });
    if (!identity) return { ok: false as const, patterns: null, blob: null };
    const { loadPatternsBlob } = await import("@/lib/engine/learning-patterns.server");
    const blob = await loadPatternsBlob(identity.userId);
    return {
      ok: true as const,
      patterns: blob?.legacy ?? null,
      blob,
    };
  });

export async function persistPatternsForUser(
  userId: string,
  state: Pick<AppState, "sessions" | "meals" | "dayCheckIns" | "profile">,
  priorBlob?: PatternsBlobV2 | null,
): Promise<boolean> {
  const { buildPatternsBlobV2 } = await import("@/lib/engine/learned-patterns");
  const { savePatternsBlob } = await import("@/lib/engine/learning-patterns.server");
  const blob = buildPatternsBlobV2(state as AppState, priorBlob ?? null);
  return savePatternsBlob(userId, blob);
}
