/**
 * Service-role Supabase admin client (typed against generated Database).
 * Prefer this over untyped casts; regenerate types after schema migrations.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export type AdminDb = SupabaseClient<Database>;

/** Cast opaque payloads into Supabase Json columns without using `any`. */
export function asJson(value: unknown): Json {
  return value as Json;
}

/** Cast row bags into typed Insert/Update payloads without using `any`. */
export function asDbRows<T = never>(
  rows: Record<string, unknown> | Record<string, unknown>[],
): T {
  return rows as T;
}

export async function adminDbLoose(): Promise<AdminDb | null> {
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    console.error("SUPABASE_SERVICE_ROLE_KEY missing — admin DB unavailable");
    return null;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
