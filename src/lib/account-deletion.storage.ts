/**
 * Storage wipe helpers for account deletion (checkins public bucket).
 * Progress photos live in photos.server.ts.
 */

/** Remove check-in / story objects under each device folder in the public checkins bucket. */
export async function removeCheckinsForDevices(deviceIds: string[]): Promise<void> {
  const ids = [...new Set(deviceIds.map((d) => d.trim()).filter(Boolean))];
  if (!ids.length) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const deviceId of ids) {
      const { data: files } = await supabaseAdmin.storage.from("checkins").list(deviceId, {
        limit: 200,
      });
      const paths = (files ?? [])
        .map((f) => f.name)
        .filter(Boolean)
        .map((name) => `${deviceId}/${name}`);
      if (!paths.length) continue;
      const chunk = 50;
      for (let i = 0; i < paths.length; i += chunk) {
        await supabaseAdmin.storage.from("checkins").remove(paths.slice(i, i + chunk));
      }
    }
  } catch (e) {
    console.error("removeCheckinsForDevices failed", e);
    throw e;
  }
}
