/**
 * Untyped service_role client for tables not yet in generated Database types.
 * Prefer regenerating types after applying identity_customer360 migration.
 */
export async function adminDbLoose(): Promise<{
  from: (table: string) => any;
} | null> {
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    console.error("SUPABASE_SERVICE_ROLE_KEY missing — admin DB unavailable");
    return null;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (table: string) => any };
}
