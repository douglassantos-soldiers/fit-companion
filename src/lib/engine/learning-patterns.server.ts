/**
 * Persist Learning Engine patterns to user_patterns (service_role).
 */
import { adminDbLoose } from "@/lib/db-admin";
import type { UserPatterns } from "@/lib/engine/learning";

export async function saveUserPatterns(
  userId: string,
  patterns: UserPatterns,
): Promise<boolean> {
  if (!userId) return false;
  const db = await adminDbLoose();
  if (!db) return false;

  const { error } = await db.from("user_patterns").upsert(
    {
      user_id: userId,
      patterns: patterns as unknown as Record<string, unknown>,
      updated_at: patterns.updatedAt || new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.warn("saveUserPatterns failed", error);
    return false;
  }
  return true;
}

export async function loadUserPatterns(userId: string): Promise<UserPatterns | null> {
  if (!userId) return null;
  const db = await adminDbLoose();
  if (!db) return null;
  const { data, error } = await db
    .from("user_patterns")
    .select("patterns")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.patterns) return null;
  return data.patterns as unknown as UserPatterns;
}
