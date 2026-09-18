/**
 * Server fns for Learning Engine — persist user_patterns best-effort.
 */
import { createServerFn } from "@tanstack/react-start";
import type { AppState } from "@/lib/types";
import type { UserPatterns } from "@/lib/engine/learning";

function parsePersist(input: unknown): { userId: string; patterns: UserPatterns } {
  const v = input as { userId?: string; patterns?: UserPatterns } | null;
  const userId = String(v?.userId ?? "").trim();
  if (!userId || userId.length < 8) throw new Error("userId inválido");
  if (!v?.patterns || typeof v.patterns !== "object") throw new Error("patterns obrigatório");
  return { userId, patterns: v.patterns };
}

/** Fire-and-forget from client boot after identity resolve. */
export const persistUserPatterns = createServerFn({ method: "POST" })
  .inputValidator(parsePersist)
  .handler(async ({ data }) => {
    const { saveUserPatterns } = await import("@/lib/engine/learning-patterns.server");
    const ok = await saveUserPatterns(data.userId, data.patterns);
    return { ok };
  });

/** Convenience: extract + persist from AppState slice (server-side). */
export async function persistPatternsForUser(
  userId: string,
  state: Pick<AppState, "sessions" | "meals">,
): Promise<boolean> {
  const { extractUserPatterns } = await import("@/lib/engine/learning");
  const { saveUserPatterns } = await import("@/lib/engine/learning-patterns.server");
  const patterns = extractUserPatterns(state as AppState);
  return saveUserPatterns(userId, patterns);
}
