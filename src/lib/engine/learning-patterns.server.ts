/**
 * Persist Learning Engine patterns to user_patterns (service_role).
 * Blob v2: { version: 2, legacy: UserPatterns, patterns: LearnedPattern[] }
 * Legacy flat UserPatterns still load via parsePatternsBlob.
 */
import { adminDbLoose } from "@/lib/db-admin";
import type { UserPatterns } from "@/lib/engine/learning";
import { parsePatternsBlob, type PatternsBlobV2 } from "@/lib/engine/learned-patterns";

export async function savePatternsBlob(userId: string, blob: PatternsBlobV2): Promise<boolean> {
  if (!userId) return false;
  const db = await adminDbLoose();
  if (!db) return false;

  const { error } = await db.from("user_patterns").upsert(
    {
      user_id: userId,
      patterns: blob as unknown as Record<string, unknown>,
      updated_at: blob.legacy.updatedAt || new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.warn("savePatternsBlob failed", error);
    return false;
  }
  return true;
}

/** @deprecated Prefer savePatternsBlob — still accepts flat UserPatterns for compat. */
export async function saveUserPatterns(
  userId: string,
  patterns: UserPatterns | PatternsBlobV2,
): Promise<boolean> {
  if (!userId) return false;
  if (patterns && typeof patterns === "object" && "version" in patterns) {
    const ver = (patterns as PatternsBlobV2).version;
    if (ver === 2 || ver === 3) {
      return savePatternsBlob(userId, patterns as PatternsBlobV2);
    }
  }
  const legacy = patterns as UserPatterns;
  const blob: PatternsBlobV2 = {
    version: 2,
    legacy,
    patterns: [],
  };
  return savePatternsBlob(userId, blob);
}

export async function loadPatternsBlob(userId: string): Promise<PatternsBlobV2 | null> {
  if (!userId) return null;
  const db = await adminDbLoose();
  if (!db) return null;
  const { data, error } = await db
    .from("user_patterns")
    .select("patterns")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.patterns) return null;
  return parsePatternsBlob(data.patterns);
}

/** Returns legacy flat patterns for callers that still expect UserPatterns. */
export async function loadUserPatterns(userId: string): Promise<UserPatterns | null> {
  const blob = await loadPatternsBlob(userId);
  return blob?.legacy ?? null;
}
