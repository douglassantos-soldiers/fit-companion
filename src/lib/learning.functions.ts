/**
 * Server fns for Learning Engine — resolve userId from session/device, never trust client claim.
 */
import { createServerFn } from "@tanstack/react-start";
import type { AppState } from "@/lib/types";
import type { UserPatterns } from "@/lib/engine/user-patterns";
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

/** Persist patterns for the session user (requireAccess). Accepts flat or blob v2/v3. Merges prior outcomes. */
export const persistUserPatterns = createServerFn({ method: "POST" })
  .inputValidator(parsePersist)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccess: true,
    });
    if (!identity) return { ok: false as const };
    const { loadPatternsBlob, savePatternsBlob } =
      await import("@/lib/engine/learning-patterns.server");
    const { parsePatternsBlob, mergeLearnedPatternOutcomes } =
      await import("@/lib/engine/learned-patterns");
    const { mergeInterventionResponses } = await import("@/lib/engine/learning/responses");
    const prior = await loadPatternsBlob(identity.userId);
    const incoming = parsePatternsBlob(data.patterns);
    if (!incoming) {
      const { saveUserPatterns } = await import("@/lib/engine/learning-patterns.server");
      const ok = await saveUserPatterns(identity.userId, data.patterns);
      return { ok };
    }
    const blob: PatternsBlobV2 = {
      version: 3,
      legacy: incoming.legacy,
      patterns: mergeLearnedPatternOutcomes(prior?.patterns, incoming.patterns),
    };
    const responses = mergeInterventionResponses(
      prior?.interventionResponses,
      incoming.interventionResponses,
    );
    if (responses.length) blob.interventionResponses = responses;
    const ok = await savePatternsBlob(identity.userId, blob);
    return { ok };
  });

/** Load persisted patterns blob (v2/v3) for the device's user. */
export const loadUserPatternsFn = createServerFn({ method: "POST" })
  .inputValidator(parseLoad)
  .handler(async ({ data }) => {
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccessIfLinked: true,
    });
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
  const { buildPatternsBlob, mergeLearnedPatternOutcomes } =
    await import("@/lib/engine/learned-patterns");
  const { loadPatternsBlob, savePatternsBlob } =
    await import("@/lib/engine/learning-patterns.server");
  const { mergeInterventionResponses } = await import("@/lib/engine/learning/responses");
  const stored = priorBlob ?? (await loadPatternsBlob(userId));
  const built = buildPatternsBlob(state as AppState, stored ?? null);
  built.patterns = mergeLearnedPatternOutcomes(stored?.patterns, built.patterns);
  const responses = mergeInterventionResponses(
    stored?.interventionResponses,
    built.interventionResponses,
  );
  if (responses.length) built.interventionResponses = responses;
  return savePatternsBlob(userId, built);
}
